"""
Local Threads scraper — a second, free lead source that runs on this PC alongside Apify.

WHAT THIS DOES
  Visits public Threads search result pages for a list of keywords using your
  real installed Chrome, in headless mode. No login, no cookies, no saved
  session — nothing here is tied to your Threads or Instagram account, so
  there is no account to put at risk. The only real-world effect is requests
  going out from this PC's IP address; running it a few times a day (not
  continuously) keeps that unremarkable.

WHAT THIS DOES NOT DO
  It never logs in, never posts, never follows/likes, never touches your
  Supabase database directly, and never modifies the Apify setup. It only
  reads public pages and forwards what it finds to the same ingest-leads
  Edge Function Apify already posts to — which independently re-checks
  freshness, relevance (Gemini), and de-duplication before anything reaches
  Telegram. If this script is ever deleted, nothing else breaks.

WHY A SEPARATE SOURCE
  Apify is capped at ~$0.055/run to stay inside the $5/month free tier, so it
  can only afford a handful of keywords and posts per run. This script has no
  per-post cost, so it can run a wider keyword list to catch more leads. The
  ingest-leads function dedupes by post_id, so if Apify and this script both
  see the same post, only one lead is ever created.

USAGE
  python scrape_threads.py                 # runs all keywords once
  python scrape_threads.py "type beat"     # runs a single keyword (testing)
"""

import json
import random
import sys
import time
import urllib.request
from datetime import datetime, timezone

from scrapling.fetchers import StealthyFetcher

# ── Config ──────────────────────────────────────────────────────────────────

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
INGEST_URL = "https://hylrkrfmxsnocauibqnt.supabase.co/functions/v1/ingest-leads?platform=threads"

# Wider than Apify's 5 — this channel has no per-post cost, so cast a broad
# net and let the Edge Function's Gemini pass and freshness/dedup filters do
# the sorting. Includes phrases Apify's actor returned zero results for;
# worth re-testing here since this hits Threads' page directly rather than
# through the actor's own search logic.
KEYWORDS = [
    "need beats",
    "looking for beats",
    "type beat",
    "beats for sale",
    "podcast audio editing",
    "need a producer",
]
# Tried and dropped 2026-09-04 — each returned 0 results on Threads' own search,
# same behaviour Apify's actor saw with similarly-phrased queries. Threads'
# search seems to need shorter, more literal phrases. Re-test occasionally,
# but don't re-add without checking first — dead queries just add run time.
#   "need mixing", "need mastering", "selling beats", "no one buys my beats",
#   "need a beatmaker", "need an audio engineer", "need a beat", "buy my beats",
#   "looking for a producer", "need mixing engineer", "need a mix"

FRESHNESS_DAYS = 7  # matches the Edge Function; posts older than this are dropped server-side anyway


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def scrape_keyword(query: str) -> list[dict]:
    """Fetch one search page and return normalized post dicts. Read-only, no login."""
    url = f"https://www.threads.com/search?q={query.replace(' ', '+')}&serp_type=default"
    try:
        page = StealthyFetcher.fetch(
            url,
            headless=True,
            network_idle=True,
            timeout=45000,
            real_chrome=True,
            executable_path=CHROME_PATH,
        )
    except Exception as e:
        log(f"  fetch failed for '{query}': {e}")
        return []

    containers = page.css("div[data-pressable-container='true']")
    posts = []
    for c in containers:
        user_links = c.css("a[href^='/@']")
        post_links = c.css("a[href*='/post/']")
        time_els = c.css("time")
        if not (user_links and post_links):
            continue

        username = user_links[0].attrib.get("href", "").strip("/").lstrip("@")
        post_href = post_links[0].attrib.get("href", "")
        post_id = post_href.rstrip("/").split("/")[-1]
        post_url = "https://www.threads.com" + post_href
        iso_date = time_els[0].attrib.get("datetime") if time_els else None

        text = c.get_all_text(separator=" ", ignore_tags=("script", "style")).strip()
        # Strip the leading "username Xh More" header the container includes,
        # so the Gemini pass reads the actual post rather than UI chrome.
        if text.startswith(username):
            text = text[len(username):].lstrip()
        for junk in ("More", "Verified"):
            if text.startswith(junk):
                text = text[len(junk):].lstrip()

        if username and post_id and text:
            posts.append({
                "id": post_id,
                "username": username,
                "text": text,
                "date": iso_date or datetime.now(timezone.utc).isoformat(),
                "url": post_url,
            })
    return posts


def send_batch(posts: list[dict]) -> dict:
    """POST the raw items array to the same Edge Function Apify uses."""
    body = json.dumps(posts).encode("utf-8")
    req = urllib.request.Request(
        INGEST_URL, data=body, method="POST",
        headers={"Content-Type": "application/json"},
    )
    # A big batch (dozens of posts) means several sequential Gemini calls plus
    # a Telegram send per kept lead server-side — this can take a few minutes.
    # A short client timeout here doesn't stop that work, it just stops us
    # from seeing the result, so it's set generously.
    with urllib.request.urlopen(req, timeout=280) as res:
        return json.loads(res.read().decode("utf-8"))


def main():
    keywords = [sys.argv[1]] if len(sys.argv) > 1 else KEYWORDS
    log(f"Starting local Threads scrape — {len(keywords)} keyword(s)")

    all_posts: dict[str, dict] = {}  # dedupe within this run by post id
    for kw in keywords:
        log(f"Searching: \"{kw}\"")
        posts = scrape_keyword(kw)
        log(f"  found {len(posts)} posts")
        for p in posts:
            all_posts[p["id"]] = p
        # Small human-like pause between searches. Not required for safety
        # (no login/session to protect) but avoids a burst pattern.
        time.sleep(random.uniform(2, 5))

    unique_posts = list(all_posts.values())
    log(f"Total unique posts this run: {len(unique_posts)}")

    if not unique_posts:
        log("Nothing to send.")
        return

    try:
        result = send_batch(unique_posts)
        log(f"Sent to ingest-leads: {result}")
    except Exception as e:
        log(f"Failed to send batch: {e}")


if __name__ == "__main__":
    main()
