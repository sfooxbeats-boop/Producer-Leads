# Producer Leads — Project Context for Claude

This file gives Claude (or any developer) the context needed to work on this codebase quickly.

## What this app is

**Producer Leads** is a system that finds music producers' potential clients on social media and delivers them to Telegram every morning.

The architecture changed on 2026-05-31 — Meta business verification was denied, so the app no longer uses the official Threads API. Instead it uses **Apify** to scrape public posts, sends them through a **Supabase Edge Function** which filters and dedupes, then forwards qualifying leads to a **Telegram bot** with quick-action buttons (DM on Instagram, View Post). The Expo web/mobile dashboard still exists as a backup view but Telegram is the primary interface now.

Two audience types are targeted:
1. **Artists looking for producers/beats/mixing/mastering** — original audience
2. **Producers selling or struggling to sell beats** — anyone posting their own beats, including #typebeat promo. The owner's website helps producers grow beat sales, so a promoter is a customer, not a reject.

Owner: sfooxbeats (sfooxbeats@gmail.com) — **complete beginner** in app development. Explanations should be plain-language and detailed.

## Tech Stack

| Layer | Tool | Notes |
|-------|------|-------|
| Lead scraping (cloud) | **Apify** (Actor `automation-lab/threads-scraper`) | 2x/day, pay-per-event, capped by free tier |
| Lead scraping (local) | **local-scraper/** (Scrapling + real Chrome) | Threads 3x/day + Reddit 2x/day, on owner's PC via Task Scheduler, $0 |
| Lead ingestion | **Supabase Edge Function** (`ingest-leads`) | Filters by age, dedupes, reads intent via Gemini, fires Telegram |
| Notifications | **Telegram Bot** (@ProducerLeadsbot) | Inline keyboard buttons for Instagram + post URL |
| Frontend | Expo (React Native) SDK 54 + Expo Router 6 | Dashboard reads leads from Supabase |
| Styling | NativeWind v4 + Tailwind CSS 3 | |
| Auth + DB | Supabase | |
| Hosting | Vercel (web) | |

## Folder Structure

```
app/                    # Screens (file-based routing)
  index.tsx             # Entry — DEV MODE: redirects to dashboard
  _layout.tsx           # Root layout — DEV MODE: no auth gate
  (auth)/sign-in.tsx    # Google sign in
  (app)/dashboard.tsx   # Reads leads from Supabase (filtered by platform)
  (app)/settings.tsx    # Placeholder in dev mode
  onboarding.tsx        # Bypassed in dev mode
  auth/callback.tsx     # OAuth redirect handler
  privacy.tsx           # Privacy policy page (legacy from Meta App Review)

components/
  LeadCard.tsx          # Renders a single lead — platform badge, email, IG + post buttons

lib/
  supabase.ts           # Supabase client + auth helpers
  threads.ts            # Now mostly defines the Lead type + fetchLeadsFromDatabase()
  mockLeads.ts          # Legacy mock data
  keywords.ts           # Legacy keyword lists (no longer used at runtime)

supabase/
  functions/
    ingest-leads/
      index.ts          # Edge Function — webhook target for Apify, sends to Telegram
  migrations/
    recreate_leads.sql  # SQL for the rebuilt leads table

privacy.html            # Static privacy policy (legacy from Meta App Review)
vercel.json             # Vercel SPA config
.env                    # Supabase + (legacy) Threads credentials — gitignored
```

## Environment Variables

App-side (Expo, prefixed `EXPO_PUBLIC_`):
```
EXPO_PUBLIC_SUPABASE_URL=https://hylrkrfmxsnocauibqnt.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

Edge Function secrets (set via `supabase secrets set`, never in code):
```
TELEGRAM_BOT_TOKEN     # Producer Leads bot
TELEGRAM_CHAT_ID       # Owner's personal chat ID (7813158930)
APIFY_API_TOKEN        # Used to fetch dataset items from Apify
GEMINI_API_KEY         # Google AI Studio, free tier — intent analysis + DM writing
SUPABASE_SERVICE_ROLE_KEY  # Auto-injected by Supabase
SUPABASE_URL               # Auto-injected by Supabase
```

**Supabase personal access tokens expire roughly every 90 days.** When
`functions deploy` returns `401 Unauthorized`, that is the cause — generate a
fresh one at supabase.com/dashboard/account/tokens.

## Database Schema (Supabase)

- `users` — producer profiles (legacy from auth flow). RLS: users read/write their own row.
- `leads` — **rebuilt 2026-05-31**. Stores every lead scraped from Apify.

```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT UNIQUE NOT NULL,         -- e.g. "threads_3908721974410631605"
  platform TEXT NOT NULL DEFAULT 'threads',
  username TEXT NOT NULL,
  post_text TEXT NOT NULL,
  post_url TEXT NOT NULL,
  instagram_url TEXT NOT NULL,
  email TEXT,                            -- extracted from post text or bio
  match_tag TEXT,
  verdict TEXT,                          -- BUYER | PRODUCER | IRRELEVANT | UNREVIEWED
  why TEXT,                              -- short reason from the model
  dm TEXT,                               -- ready-to-send opener, empty for non-leads
  posted_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT now()
);
```

`post_id` uniqueness drives dedup — if a lead with the same `post_id` is already in the DB, the Edge Function skips Telegram (no duplicate notifications).

## How the daily flow works

```
06:00 and 18:00 Africa/Casablanca — Apify schedule fires
  ↓
Apify runs `automation-lab/threads-scraper` task with 5 music keywords
  ↓
On success → webhook hits Supabase Edge Function `ingest-leads`
  ↓
Edge Function runs three passes:
  Pass 1 — cheap filters, so the model only reads posts that could matter:
     - drop posts older than FRESHNESS_DAYS (7)
     - drop post_ids already in the DB
     - drop usernames already seen inside the window
  Pass 2 — send survivors to Gemini in batches of 10, get back
     { verdict, why, dm } per post
  Pass 3 — keep BUYER / PRODUCER / UNREVIEWED, drop the rest,
     upsert, then Telegram each one with its ready-to-copy DM
  A "NEW BATCH" header is sent before the first lead of a run.
  ↓
Owner reads messages in Telegram → taps "DM on Instagram" → contacts client
```

## Apify resources (production)

| Resource | ID | Purpose |
|---|---|---|
| Threads task | `G02OeSRH3YEldRKrm` | Threads keyword search |
| Threads schedule | `5w73MqsM6zK9Hnn22` | `0 6,18 * * *` Africa/Casablanca (every 12h) |
| Threads webhook | `B22WGiYPuEeCMzjPk` | Fires `ingest-leads?platform=threads` |
| Instagram task | `2AQ1GZEJweccCbL8O` | **DISABLED** as of 2026-05-31 (owner asked for Threads-only) |
| Instagram schedule | `L8Y7pX8tXrQdNFpAv` | **DISABLED** |
| Instagram webhook | `IWEeFXW8cohagYh1h` | **DISABLED** |

## Staying inside the free tier

**The budget is $5/month, not $15.** The account is on Apify's FREE plan with
`maxMonthlyUsageUsd: 5` as a hard ceiling. Runs stop when it is reached; there is no
overage bill. The risk is a lead blackout until the cycle rolls over, never a charge.

The actor bills per event, so cost is predictable:

| Event | Price |
|---|---|
| Starting a run | $0.02 |
| Each post extracted | $0.005 |

`maxTotalChargeUsd: 0.055` on the task turns that into a guarantee:
**$0.055 × 2 runs/day × 30 days = $3.30.** Changing either the cap or the schedule
frequency breaks the guarantee — recompute before touching them.

Two mechanisms keep real spend below the cap:

1. **`postedAfter` set to the freshness window** — `advanceTaskCursor()` rewrites it to
   `now - FRESHNESS_DAYS` after every run, so the actor stops scrolling once it reaches
   posts older than a week instead of dragging in years of history at $0.005 each. One
   run without it extracted 96 posts, of which 102 of the 108 items were over a week old.

   **Do not set `postedAfter` to the polling interval.** Tried on 2026-09-04 (cutoff =
   last run, 8h earlier) and three consecutive runs scraped **zero** posts: each logged
   `skippedOutsideDateWindow: 40` and `stoppedByPostedAfter: true`. Threads' search
   results are not in date order, so the actor meets an old post early and concludes
   there is nothing newer. `post_id` dedup already prevents repeats — `postedAfter` only
   has to exclude genuinely stale posts.
2. **Keyword rotation** — the same function rotates `searchQueries` by one each run.
   `maxTotalChargeUsd` aborts a run part-way through the list, so without rotation the
   last queries would never execute.

Check the burn rate any time:

```bash
curl -s "https://api.apify.com/v2/users/me/limits" -H "Authorization: Bearer $APIFY_TOKEN"
```

History: daily runs on `top` sort cost $0.17 and projected $5.27/month, already over.
Switching to `recent` tripled it to $0.50/run because the run returned 108 posts instead
of 30. That is what forced the per-run cap.

## Current keywords (Threads)

Task input also sets `searchSort: "recent"`. **This matters more than the keywords.**
The actor defaults to `top`, which returns the same relevance-ranked popular posts
every single day; dedup then correctly skips them and almost nothing new arrives.
That bug ran unnoticed from May to September 2026 and held delivery to 1–6 leads/day.

Current 5 queries, all verified to return results:
`looking for beats`, `need beats`, `type beat`, `beats for sale`, `podcast audio editing`

`type beat` is kept deliberately. It is promoter-heavy, and those promoters are the
website's customers.

Roughly half of any candidate keyword set returns nothing — Threads' public search finds
no results for longer phrases. These were dropped on 2026-09-03 after returning zero on
every run: `producer needed`, `need a mix`, `mix my song`, `mastering engineer`,
`sell my beats`, `need a rapper`, `open verse`, and every phrase of the form
"need a music producer" / "no one buys my beats".

Verify coverage after any change:

```bash
curl -s "https://api.apify.com/v2/datasets/<DATASET_ID>/items?clean=true&format=json&fields=searchQuery" \
  -H "Authorization: Bearer $APIFY_TOKEN" | grep -o '"searchQuery": "[^"]*"' | sort | uniq -c | sort -rn
```

To change keywords: `PUT /v2/actor-tasks/G02OeSRH3YEldRKrm/input`.

## Local scraper (second lead source, added 2026-09-04)

`local-scraper/scrape_threads.py` — a free, self-hosted second source that runs
on the owner's own PC via Windows Task Scheduler (task
`ProducerLeads-LocalThreadsScraper`, 09:00 / 16:00 / 21:00 daily, `--WakeToRun`).

**Why it exists:** Apify is capped at ~$0.055/run to stay inside the $5/month
free tier, which only affords a handful of keywords and posts per run. This
channel has no per-post cost, so it runs a wider keyword list. Both sources
post to the same `ingest-leads` Edge Function, which dedupes by `post_id` —
if Apify and the local scraper both see the same post, only one lead results.

**How it works:** [Scrapling](https://github.com/d4vinci/Scrapling)'s
`StealthyFetcher`, pointed at the **real installed Chrome**
(`real_chrome=True`, `executable_path=...`) rather than Playwright's bundled
Chromium — the bundled binary fails to launch in some environments
(`spawn UNKNOWN` / "side-by-side configuration incorrect") for reasons
unrelated to Scrapling itself. Visits `threads.com/search?q=...` pages, no
login, no cookies, no session. Extracts posts via
`div[data-pressable-container='true']`, reading the username from the first
`a[href^='/@']`, the post id/url from `a[href*='/post/']`, and the exact
timestamp from the `<time datetime="...">` element — this is a proper ISO
timestamp, not a parsed "2h ago" string.

**Safety:** No login means no account exists to be banned. The only real
exposure is the home IP being rate-limited by Meta, which is temporary and
avoided by running a few times a day rather than continuously. Verified
across ~4 back-to-back runs during testing with zero blocking or CAPTCHAs.

**Sends to:** the same `INGEST_URL` as Apify's webhook, but as a raw JSON
array (Apify sends `{resource: {defaultDatasetId}}` and the function fetches
the dataset separately; this script skips that and posts the array directly —
`ingest-leads` already supports both shapes).

**Current keywords** (9, in `scrape_threads.py`): `need beats`,
`looking for beats`, `type beat`, `beats for sale`, `podcast audio editing`,
`need a producer`, `i need beats`, `send me beats`, `podcast editor needed`.
A longer list was tried and mostly returned zero — see the comment in the
script for the dead list. Threads' own search seems to want short, literal
phrases; don't re-add without testing first.

**Real yield, measured 2026-09-04:** a first run against an empty history
found 54 unique posts → 24 leads. A second run 35 minutes later against the
same 6 keywords found 56 posts but only 4 became new leads — the rest were
already-seen duplicates. Threads doesn't have infinite fresh supply for a
fixed keyword list; **this is why [Reddit](#reddit-scraper-fourth-lead-source-added-2026-09-04)
was added as a second local source** rather than just running Threads more
often.

**Gotcha this uncovered:** `advanceTaskCursor()` in the Edge Function used to
run for `platform=threads` regardless of caller, so this script was silently
rewriting Apify's task cursor/keyword rotation on every run. Fixed by gating
it on `datasetId` being present (i.e. the call genuinely came from Apify's
webhook, not from this script posting a raw array).

**Also uncovered:** Gemini's retry logic (2 attempts, flat 3s wait) was too
weak for a big batch — a 56-post run produced 20 `UNREVIEWED` leads from
rate-limit collisions with concurrent testing. Fixed: 4 attempts with
exponential backoff (2s/4s/8s), and inter-batch spacing widened from 4.5s to
6.5s so the pipeline alone stays near 9 calls/minute against Gemini's
15/minute free-tier ceiling, leaving headroom for both sources landing close
together.

To run manually: `venv\Scripts\python.exe scrape_threads.py` (all keywords)
or `... scrape_threads.py "type beat"` (one keyword, for testing).

### Logon trigger — the PC is shut down overnight (added 2026-09-05)

The owner shuts the PC down at night, so the 09:00 / 16:00 / 21:00 daily
triggers were missing their windows entirely. `WakeToRun` cannot help — it
wakes a *sleeping* machine, not a powered-off one.

Both tasks now carry a **`LogonTrigger` in addition to** their daily times, so
a scrape happens whenever the PC is switched on:

| Task | Daily triggers | Logon delay |
|---|---|---|
| `ProducerLeads-LocalThreadsScraper` | 09:00 / 16:00 / 21:00 | `PT2M` |
| `ProducerLeads-RedditScraper` | 10:00 / 18:00 | `PT5M` |

The delays stagger the two so they don't both launch Chrome into a machine
that is still finishing boot. Duplicate delivery is not a concern — `post_id`
dedup in `ingest-leads` already covers a logon run landing near a daily one.

**How to add a logon trigger — the cmdlets don't work, the XML does.** This
was previously recorded here as impossible. It isn't; the earlier attempt just
used the blocked API. Both of these return `Access is denied` in this coding
environment, for `AtLogOn` and `AtStartup` alike, whether creating a new task
or modifying an existing one:

```powershell
Register-ScheduledTask -Trigger (New-ScheduledTaskTrigger -AtLogOn) ...   # Access is denied
Set-ScheduledTask      -Trigger (New-ScheduledTaskTrigger -AtLogOn) ...   # Access is denied
```

Going through task XML is a different code path and is **not** blocked:

```powershell
$xml = Export-ScheduledTask -TaskName "ProducerLeads-LocalThreadsScraper"
$xml = $xml -replace '  </Triggers>', @'
    <LogonTrigger>
      <Enabled>true</Enabled>
      <UserId>S-1-5-21-1841663455-1283785925-1625173495-1001</UserId>
      <Delay>PT2M</Delay>
    </LogonTrigger>
  </Triggers>
'@
Register-ScheduledTask -TaskName "ProducerLeads-LocalThreadsScraper" -Xml $xml -Force
```

`Export-ScheduledTask` first, always — `-Force` replaces the whole task, so an
edit built from anything other than the live definition silently drops the
daily triggers and settings.

### `run_hidden.py` — why the tasks don't run python.exe directly

A logon trigger running `python.exe` flashes a console window on screen at
every startup. The tasks therefore run **`pythonw.exe run_hidden.py <script>`**
instead, which has no console at all.

The catch `run_hidden.py` exists to solve: `pythonw.exe` discards `print()`,
and both scrapers log exclusively through `print()`, so a silent run would also
be an undiagnosable one. The launcher redirects `stdout`/`stderr` into
`local-scraper/scraper.log` (self-truncating past 1 MB), stamps each run, and
catches tracebacks that would otherwise vanish with the console. It forwards
extra arguments through, so `pythonw.exe run_hidden.py scrape_reddit.py
makinghiphop "need beats"` still works for one-off testing.

`scraper.log` is the first place to look when leads stop arriving.

**Verified end-to-end 2026-09-05**, run through Task Scheduler itself rather
than a direct invocation: `LastTaskResult: 0`, no window, 86 posts scraped,
14 leads delivered to Telegram.

**Still true:** the PC must be on *at some point*. These tasks fire at logon
and at their daily times; they cannot run while the machine is off. That is
the accepted trade for a $0 lead source — Apify's cloud schedule is the
channel that keeps running regardless.

**Also found and fixed:** `DisallowStartIfOnBatteries` defaulted to `true`.
This machine is a laptop, so every run would have silently been skipped
while unplugged. Fixed via `-AllowStartIfOnBatteries -DontStopIfGoingOnBatteries`
on `New-ScheduledTaskSettingsSet` — note these are separate parameters from
`-DisallowStartIfOnBatteries:$false` and `-StopIfGoingOnBatteries:$false`,
which don't exist as settable switches on that cmdlet.

## Reddit scraper (fourth lead source, added 2026-09-04)

`local-scraper/scrape_reddit.py` — same free, no-login approach as the
Threads scraper, added because Threads' matching phrases run out fast (see
above). Runs via Task Scheduler task `ProducerLeads-RedditScraper`, 10:00 and
18:00 daily — offset from the Threads scraper's 09:00/16:00/21:00 so the two
don't compete for Chrome at the same time.

**Why two requests per lead:** Reddit's search-results page shows title,
subreddit, and relative time, but **not the author**. The author only
appears on the individual post's own page, as the `author` attribute on its
`<shreddit-post>` custom element. Skipping this would leave every Reddit
lead with the same blank username, and the Edge Function's per-user dedup
(`eq('username', ...)`) would then treat the second Reddit lead ever seen as
a duplicate of the first — so: search page for candidates → filter to fresh
ones → visit each survivor's own page for its author. `MAX_DETAIL_FETCHES`
(25) caps how many of these per-post lookups happen in one run.

**Reddit blocks its own `.json` API shortcut now.** The well-known
`reddit.com/r/.../comments/ID/title.json` trick returns 403 even through the
same real-Chrome method that works for the normal HTML page — confirmed by
testing both. Reddit tightened this after their 2023 API pricing changes.
Plain `curl` to the search endpoint also gets a 403 bot-challenge page; only
the real-Chrome approach gets through.

**No Instagram equivalent for Reddit leads.** `instagram_url` is sent as
`''` (satisfies the NOT NULL column) rather than null. The Edge Function
reads an empty `instagram_url` as a signal to swap the Telegram button to
"💬 Reply on Reddit", linking `reddit.com/user/<username>` — sfoox has to
message them from his own logged-in Reddit account; this script never logs
in anywhere, it only discovers the lead.

**Signal-to-noise:** Reddit's search is fuzzy/semantic, not literal like
Threads'. A search for "need beats" in r/WeAreTheMusicMakers surfaced real
leads ("I need a producer") alongside unrelated discussion ("When
sidechaining Kick and Bass, is there a need to EQ..."). No extra filtering
needed — the same Gemini BUYER/PRODUCER/IRRELEVANT pass already used for
Threads handles it; verified 11 of 12 candidates correctly classified in one
test run.

**Current subreddit/keyword pairs** (8, in `scrape_reddit.py`):
`makinghiphop` × (`looking for producer`, `need beats`, `need a mix`),
`trapproduction` × `need beats`, `Beatmakers` × `need beats`,
`WeAreTheMusicMakers` × `need mixing`, `podcasting` × `need editor`,
`mixingmastering` × `need help mixing`.

**Instagram itself was tested and ruled out** as a fourth source: hashtag
pages (`/explore/tags/...`) — the only way to discover posts by topic rather
than a known username — redirect straight to Instagram's login wall (302 →
`/accounts/login/`). A plain profile page loads fine, but that's no use for
lead discovery. Confirmed 2026-09-04; don't re-attempt without a different
approach (e.g. a logged-in session, which reopens the account-risk problem
this whole local-scraper approach was built to avoid).

To run manually: `venv\Scripts\python.exe scrape_reddit.py` (all pairs) or
`... scrape_reddit.py makinghiphop "need beats"` (one pair, for testing).

## Intent analysis (Gemini)

Keyword matching cannot do this job and was replaced on 2026-09-03. It could not tell
"I need beats" from "check out my beat", so it delivered promoters, competitors
advertising their own services, and job postings as leads.

The Edge Function now sends each surviving post to **Gemini (free tier)**, which
returns `{ verdict, why, dm }`.

| Verdict | Meaning | Telegram? |
|---|---|---|
| `BUYER` | Wants to *receive* beats, mixing, mastering, audio/podcast editing | 💰 yes |
| `PRODUCER` | Makes beats and is trying to sell them — the website's audience | 🎹 yes |
| `IRRELEVANT` | Competitors touting the same services, job adverts, general chat | no |
| `UNREVIEWED` | Gemini failed after retries | ⚠️ yes, flagged |
| `STRUGGLING_PRODUCER` | Legacy, folded into `PRODUCER` on 2026-09-03 | 🎹 yes (old rows) |

**Anyone promoting their own beats is a `PRODUCER`, not a reject.** A #typebeat post is
someone trying to sell beats, which is exactly who the website serves. Only people who
*compete* with sfoox (mixing engineers, podcast editors advertising for work) are ruled
out. The DM branches on this: BUYER gets offered the service they asked for, PRODUCER
gets asked about their sales and is never offered beats.

The prompt's core instruction is **direction**: is the poster asking to *receive*
something (buyer) or offering to *give* something (promoter)? "post your links" and
"send me your beats" are buyers even though they read like offers.

DM rules baked into the prompt: under 28 words, lowercase, one question, must open
with "saw", and must never claim an action that has not happened ("sent you",
"just listened"). An earlier draft hallucinated "sent some samples to your email",
which is why that ban is explicit.

`analyzeBatch()` re-aligns results on the `i` index the model echoes back, so a
dropped item cannot shift every later verdict onto the wrong post.

**Cost: $0.** ~10 calls/day against a free tier of 15 RPM and 1M tokens/day.

## Common Commands

```bash
# Expo dev server
npx expo start --clear

# Deploy Edge Function changes
SUPABASE_ACCESS_TOKEN=sbp_xxx npx supabase functions deploy ingest-leads \
  --project-ref hylrkrfmxsnocauibqnt --no-verify-jwt

# Update a Supabase secret
SUPABASE_ACCESS_TOKEN=sbp_xxx npx supabase secrets set KEY=value \
  --project-ref hylrkrfmxsnocauibqnt

# Run SQL against the linked Supabase project
SUPABASE_ACCESS_TOKEN=sbp_xxx npx supabase db query --linked "SELECT ..."

# Trigger Apify task manually
curl -X POST "https://api.apify.com/v2/actor-tasks/G02OeSRH3YEldRKrm/runs" \
  -H "Authorization: Bearer apify_api_..." -d '{}'

# Re-export web build for Vercel (when shipping UI changes)
npx expo export --platform web && cp privacy.html dist/privacy.html
```

## Telegram bot info

- Bot: **@ProducerLeadsbot** (t.me/ProducerLeadsbot)
- Chat ID: `7813158930`
- **Important:** the user must have started a chat with the bot at least once. Otherwise Telegram returns `400 chat not found`.
- Each lead message has two inline keyboard buttons: `📸 DM on Instagram` (opens `instagram.com/{username}`) and `🧵 View Post` (opens the original Threads post).
- Batch headers (`━━ NEW BATCH · THREADS ━━`) precede the first new lead of each run so the owner can see where today's batch starts.

## Gotchas / Known Issues

1. **Directory name has a space** ("Producer Leads"). `npx create-expo-app .` fails on it.
2. **legacy-peer-deps required** — see `.npmrc`. Don't remove.
3. **NativeWind v4 babel** — `nativewind/babel` is a **preset**, not a plugin.
4. **NativeWind v4 needs `react-native-worklets`** installed alongside.
5. **OAuth on Expo Go vs web** — `sign-in.tsx` branches on `Platform.OS` (legacy from when auth was active).
6. **Vercel SPA fallback** — use `rewrites[]` in `vercel.json`, NOT `routes[]` (routes intercept JS/CSS).
7. **Vercel env vars** — `EXPO_PUBLIC_*` vars are baked at build time. Build locally with `npx expo export --platform web`, commit the `dist/` folder, and keep `"buildCommand": ""`.
8. **`automation-lab/threads-scraper` field names** — uses `searchQueries` (array) + `mode: "search"` + `maxPosts`. NOT `keywords` like the deprecated `futurizerush` actor.
9. **Threads post timestamps are Unix seconds, not ISO** — multiply by 1000 before `new Date(...)`. The Edge Function uses `item.date` (ISO) preferentially with `item.timestamp` as fallback.
10. **Telegram bot needs first user contact** — the bot can't message you until you've sent it `/start`.
11. **Telegram requires UTF-8 with explicit `charset=utf-8`** in Content-Type. Without it, emojis cause `400 Bad Request`.
12. **Apify webhook payload** is `{ resource: { defaultDatasetId: "..." } }` — the actual posts live in that dataset and must be fetched separately with the Apify token.
13. **Edge Function `.upsert(..., { ignoreDuplicates: true })`** still returns rows only for newly-inserted records when chained with `.select()`. That's how we avoid re-sending Telegram messages for old leads.
14. **`searchSort` defaults to `top`.** For a daily monitor you want `recent`. See the keywords section — this silently capped delivery for three months.
15. **Threads search returns mostly stale posts.** In a 108-post sample only 2 were inside 48h and 6 inside 7 days. `FRESHNESS_DAYS` in the Edge Function is 7 for that reason. Tightening it back to 2 will drop delivery to near zero.
16. **`gemini-2.5-flash` is retired for new API keys** (404 "no longer available to new users"). Use `gemini-flash-lite-latest`. List what a key can actually reach with `GET /v1beta/models` before assuming a model name works.
17. **Gemini keys from AI Studio can start with `AQ.` rather than `AIza`.** Both are valid. They authenticate via the `x-goog-api-key` header or `?key=`, **not** as a `Bearer` token (that returns 401).
18. **AI Studio needs a Google Cloud project** before it will enable the "Create key" button. Create one free at console.cloud.google.com first; no card required.
19. **Bash heredocs mangle this file's template literals.** Writing `index.ts` through a `cat <<'EOF'` heredoc fails with "unexpected EOF". Use the Write tool for that file.

## Open-source alternatives (investigated 2026-09-03)

Checked whether free self-hosted scrapers could **replace** Apify entirely. As an
always-on server, no — see below. As a **supplement running on the owner's own
PC**, yes: see [Local scraper](#local-scraper-second-lead-source-added-2026-09-04)
above, added 2026-09-04.

| Project | Finding |
|---|---|
| `Zeeshanahmad4/Threads-Scraper` (130★) | **Not real software.** No HTTP request anywhere in the repo, no threads.net URL, `parser.py` only parses data handed to it. README is an advert for a scraping agency (bitbash9@gmail.com). |
| `instaloader` (13k★) | Genuine and maintained, but Instagram restricts anonymous access, so volume needs a logged-in account and risks a ban on the account the business depends on. |
| `omkarcloud/website-email-contact-scraper` | 3 stars, no license. Enrichment (emails from known sites), not lead discovery. |
| `*/All-in-One-Social-Email-Scraper` | Near-identical descriptions across unrelated accounts, two now 404 from the GitHub API. Malware distribution pattern. **Do not install.** |
| `ScrapeGraphAI/Scrapegraph-ai` (30k★) | Real, but solves the wrong layer — LLM-based extraction from a page you already fetched. Doesn't get you past Threads' login wall, and would burn the Gemini free tier much faster (one call per page). |
| `Panniantong/Agent-Reach` (78k★) | Real, but **zero Threads support** — confirmed by grep, not just skimming. Its Instagram path reuses the user's own logged-in desktop Chrome session, the exact account-ban risk instaloader also carries. |
| `d4vinci/Scrapling` (78k★) | **This is what `local-scraper/` uses.** Genuine, actively maintained, BSD-3. A framework, not a Threads scraper — the Threads-specific logic (selectors, timestamp parsing) had to be written on top of it. |

**Why the "as a server" conclusion still holds:** Threads blocks datacenter IPs, so
an always-on server still needs residential proxies ($8–30/mo) plus the server
itself ($5/mo) plus someone to repair the scraper each time Meta changes their
markup. Apify's ~$7/mo buys exactly that, so replacing Apify with a hosted
self-built scraper is still not worth it.

**Why "on the owner's own PC" is different:** a home connection already has a
residential IP, so the proxy cost disappears. The remaining trade is the PC
needing to be on when Task Scheduler fires, and owning a scraper that could
break if Threads changes its markup — accepted as worthwhile for the free
extra lead volume. Confirmed with `real_chrome=True` pointed at the actual
installed Chrome; Playwright's own bundled Chromium failed to launch in
testing (`spawn UNKNOWN`) for reasons unrelated to Scrapling.

## Current Status (as of 2026-09-03)

Ran unattended from 2026-05-31 to 2026-09-03: ~95 scheduled runs, zero failures,
$1.53 of the $5 monthly Apify credit used. It also under-delivered that whole time
(1–6 leads/day) because of the `searchSort` default, which nobody caught until the
September audit.

### ✅ Working
- Apify Threads scraper every 12h (06:00 / 18:00 Africa/Casablanca), `searchSort: recent`
- Gemini intent analysis replacing keyword matching, free tier, $0
- Two lead streams in one Telegram chat: 💰 BUYER and 🎹 WEBSITE LEAD
- Spend mathematically capped under the $5 free tier (see above)
- Per-post DM written from that post's actual context, tap-to-copy in Telegram
- 7-day freshness window, `post_id` dedup, per-username dedup inside the window
- Batch header before the first lead of each run
- Retry when Apify fires its webhook before the dataset is committed
- `maxTotalChargeUsd: 0.5` per run; runs cost $0.17–0.50

### 📊 Honest volume expectation
Roughly **5–15 leads/day**, not the 50–80 estimated in May. Threads does not have
that many people asking for beats daily. Measured on a 108-post scrape: 2 posts
inside 48h, 6 inside 7 days. Raising the number means adding sources, not tuning
filters. Instagram is the obvious next source and is already built (see below).

### 🪦 Deprecated / Removed
- ❌ Threads official API — replaced by Apify scraping
- ❌ Meta business verification / App Review — denied, abandoned
- ❌ `isMusicLead` keyword filter — replaced by Gemini, delivered junk leads
- ❌ Template-based DM generator — replaced by Gemini, could not read context
- ❌ Self-hosted open-source scrapers — investigated and rejected, see above

### ⏳ Future / Optional
- Re-enable the Instagram task (`2AQ1GZEJweccCbL8O`) and its webhook/schedule.
  Built and working, disabled per owner request on 2026-05-31.
- Feed reply threads to Gemini as well, not just the root post. Some actors expose
  reply trees; costs more per run.
- Surface `verdict` as a dashboard filter so BUYER and PRODUCER LEAD split there too.
- Add a "mark as contacted" toggle per lead.

## Dev Mode (Auth Bypass)

Still active. To re-enable real auth:
1. Restore `app/index.tsx` to the session-checking version (see git history)
2. Restore `app/_layout.tsx` redirect logic
3. Restore `app/(app)/dashboard.tsx` to fetch user profile from Supabase
4. Restore `app/(app)/settings.tsx` full version

## User Preferences

- Update this CLAUDE.md and push to GitHub after every major change.
- Explain like a beginner — assume zero prior engineering knowledge.
- Web app first, mobile later.
- Telegram is the primary interface, dashboard is secondary.

## Useful References

- Supabase project: https://supabase.com/dashboard/project/hylrkrfmxsnocauibqnt
- Edge Function logs: https://supabase.com/dashboard/project/hylrkrfmxsnocauibqnt/functions/ingest-leads/logs
- Apify console: https://console.apify.com/actors/tasks
- Telegram bot: https://t.me/ProducerLeadsbot
- GitHub repo: https://github.com/sfooxbeats-boop/Producer-Leads
- Vercel deployment: https://producer-leads.vercel.app
- Owner's domain (unused): loopgem.com
