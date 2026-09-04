"""
Local Reddit scraper — a third lead source alongside Apify (Threads) and
scrape_threads.py, run on this PC via Windows Task Scheduler.

WHY REDDIT: Threads' available matching phrases run out fast (see
scrape_threads.py's dead-keyword list). Reddit's music subreddits carry
real hiring/collab posts too, and are reachable the same read-only way.

WHAT THIS DOES
  Visits public Reddit search-result pages and individual post pages, no
  login, no cookies, no session. Read-only, like opening the pages in a
  browser tab. Sends normalized posts to the same ingest-leads Edge Function
  the other two sources use.

WHY TWO REQUESTS PER LEAD
  Reddit's search-results page does not include the post author — only
  title, subreddit, and relative time. The author only appears on the
  individual post's own page, as the `author` attribute on its
  <shreddit-post> element. Skipping this would leave every Reddit lead with
  the same blank username, and the Edge Function's per-user dedup would then
  treat the second Reddit lead ever seen as a duplicate of the first. So:
  search page for candidates -> filter to fresh, unseen ones -> visit each
  surviving post's own page for its author. MAX_DETAIL_FETCHES caps how many
  of those second-round fetches happen per run.

CONTACTING A REDDIT LEAD: unlike Threads, Reddit usernames rarely carry an
Instagram handle. The DM sfoox writes has to be sent via Reddit's own
messaging, from his own logged-in Reddit account — this script never logs
in anywhere, it only discovers the lead. instagram_url is sent as '' for
these, which the Edge Function reads as "link the Reddit profile instead."

USAGE
  python scrape_reddit.py                 # runs all subreddit/keyword pairs
  python scrape_reddit.py makinghiphop "need beats"   # one pair, for testing
"""

import json
import random
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone

from scrapling.fetchers import StealthyFetcher

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
INGEST_URL = "https://hylrkrfmxsnocauibqnt.supabase.co/functions/v1/ingest-leads?platform=reddit"
FRESHNESS_DAYS = 7
MAX_DETAIL_FETCHES = 25  # caps the expensive per-post author lookups in one run

# (subreddit, search phrase) pairs. Reddit's search is fuzzy/semantic, not
# literal like Threads', so it returns more discussion noise — the Edge
# Function's Gemini pass already filters that out, same as for Threads.
SUBREDDIT_KEYWORDS = [
    ("makinghiphop", "looking for producer"),
    ("makinghiphop", "need beats"),
    ("makinghiphop", "need a mix"),
    ("trapproduction", "need beats"),
    ("Beatmakers", "need beats"),
    ("WeAreTheMusicMakers", "need mixing"),
    ("podcasting", "need editor"),
    ("mixingmastering", "need help mixing"),
]


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def search_reddit(subreddit: str, query: str) -> list[dict]:
    """Search one subreddit. Returns candidates with title/url/time but no author yet."""
    url = f"https://www.reddit.com/r/{subreddit}/search/?q={query.replace(' ', '+')}&restrict_sr=1&sort=new"
    try:
        page = StealthyFetcher.fetch(
            url, headless=True, network_idle=True, timeout=45000,
            real_chrome=True, executable_path=CHROME_PATH,
        )
    except Exception as e:
        log(f"  search failed for r/{subreddit} '{query}': {e}")
        return []

    if page.status != 200:
        log(f"  r/{subreddit} returned status {page.status}")
        return []

    links = page.css("a[href*='/comments/']")
    times = page.css("time")
    time_by_index = [t.attrib.get("datetime") for t in times]

    seen_hrefs: dict[str, dict] = {}
    for i, link in enumerate(links):
        href = link.attrib.get("href", "")
        title = link.get_all_text().strip()
        m = re.search(r"/comments/([a-z0-9]+)/", href)
        if not (href and title and m):
            continue
        post_id = m.group(1)
        if post_id in seen_hrefs:
            continue
        full_url = "https://www.reddit.com" + href if href.startswith("/") else href
        iso_date = time_by_index[i] if i < len(time_by_index) else None
        seen_hrefs[post_id] = {"id": post_id, "title": title, "url": full_url, "date": iso_date}
    return list(seen_hrefs.values())


def is_fresh(iso_date: str | None) -> bool:
    if not iso_date:
        return True  # unknown age -- let the server-side freshness check decide
    try:
        posted = datetime.fromisoformat(iso_date.replace("Z", "+00:00"))
        age_days = (datetime.now(timezone.utc) - posted).days
        return age_days <= FRESHNESS_DAYS
    except ValueError:
        return True


def fetch_author(post_url: str) -> str | None:
    """Visit a post's own page to read its <shreddit-post author=...> attribute."""
    try:
        page = StealthyFetcher.fetch(
            post_url, headless=True, network_idle=True, timeout=30000,
            real_chrome=True, executable_path=CHROME_PATH,
        )
        posts = page.css("shreddit-post")
        if posts:
            return posts[0].attrib.get("author")
    except Exception as e:
        log(f"  author lookup failed for {post_url}: {e}")
    return None


def send_batch(posts: list[dict]) -> dict:
    body = json.dumps(posts).encode("utf-8")
    req = urllib.request.Request(
        INGEST_URL, data=body, method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=280) as res:
        return json.loads(res.read().decode("utf-8"))


def main():
    if len(sys.argv) > 2:
        pairs = [(sys.argv[1], sys.argv[2])]
    else:
        pairs = SUBREDDIT_KEYWORDS

    log(f"Starting Reddit scrape — {len(pairs)} subreddit/keyword pair(s)")

    all_candidates: dict[str, dict] = {}
    for sub, kw in pairs:
        log(f"Searching r/{sub}: \"{kw}\"")
        found = search_reddit(sub, kw)
        log(f"  found {len(found)} candidates")
        for c in found:
            all_candidates[c["id"]] = c
        time.sleep(random.uniform(2, 4))

    fresh = [c for c in all_candidates.values() if is_fresh(c["date"])]
    log(f"Unique candidates: {len(all_candidates)}, fresh enough to check: {len(fresh)}")

    if len(fresh) > MAX_DETAIL_FETCHES:
        log(f"Capping author lookups at {MAX_DETAIL_FETCHES} (newest first)")
        fresh.sort(key=lambda c: c["date"] or "", reverse=True)
        fresh = fresh[:MAX_DETAIL_FETCHES]

    posts_to_send = []
    for c in fresh:
        author = fetch_author(c["url"])
        if author:
            posts_to_send.append({
                "id": c["id"],
                "username": author,
                "title": c["title"],
                "url": c["url"],
                "date": c["date"] or datetime.now(timezone.utc).isoformat(),
            })
        time.sleep(random.uniform(1.5, 3))

    log(f"Posts with a resolved author: {len(posts_to_send)}")

    if not posts_to_send:
        log("Nothing to send.")
        return

    try:
        result = send_batch(posts_to_send)
        log(f"Sent to ingest-leads: {result}")
    except Exception as e:
        log(f"Failed to send batch: {e}")


if __name__ == "__main__":
    main()
