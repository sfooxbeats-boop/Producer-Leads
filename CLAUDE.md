# Producer Leads — Project Context for Claude

This file gives Claude (or any developer) the context needed to work on this codebase quickly.

## What this app is

**Producer Leads** is a system that finds music producers' potential clients on social media and delivers them to Telegram every morning.

The architecture changed on 2026-05-31 — Meta business verification was denied, so the app no longer uses the official Threads API. Instead it uses **Apify** to scrape public posts, sends them through a **Supabase Edge Function** which filters and dedupes, then forwards qualifying leads to a **Telegram bot** with quick-action buttons (DM on Instagram, View Post). The Expo web/mobile dashboard still exists as a backup view but Telegram is the primary interface now.

Two audience types are targeted:
1. **Artists looking for producers/beats/mixing/mastering** — original audience
2. **Producers struggling to sell beats** — added 2026-05-31 because the owner's new website helps producers grow beat sales

Owner: sfooxbeats (sfooxbeats@gmail.com) — **complete beginner** in app development. Explanations should be plain-language and detailed.

## Tech Stack

| Layer | Tool | Notes |
|-------|------|-------|
| Lead scraping | **Apify** (Actor `automation-lab/threads-scraper`) | Daily cron, pay-per-event |
| Lead ingestion | **Supabase Edge Function** (`ingest-leads`) | Filters 48h + music-relevance, dedupes, fires Telegram |
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
SUPABASE_SERVICE_ROLE_KEY  # Auto-injected by Supabase
SUPABASE_URL               # Auto-injected by Supabase
```

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
  posted_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT now()
);
```

`post_id` uniqueness drives dedup — if a lead with the same `post_id` is already in the DB, the Edge Function skips Telegram (no duplicate notifications).

## How the daily flow works

```
6:00 AM Africa/Casablanca — Apify schedule fires
  ↓
Apify runs `automation-lab/threads-scraper` task with 12 music keywords
  ↓
On success → webhook hits Supabase Edge Function `ingest-leads`
  ↓
Edge Function:
  1. Fetches dataset items from Apify using APIFY_API_TOKEN
  2. For each post:
     - Skip if older than 48h
     - Skip if not music-related (see isMusicLead filter)
     - Upsert into `leads` table (dedupe by post_id)
     - If newly inserted: send a Telegram message with two buttons
  3. Before the first lead of a batch, sends a "NEW BATCH" header message
  ↓
Owner reads messages in Telegram → taps "DM on Instagram" → contacts client
```

## Apify resources (production)

| Resource | ID | Purpose |
|---|---|---|
| Threads task | `G02OeSRH3YEldRKrm` | Daily Threads keyword search |
| Threads schedule | `5w73MqsM6zK9Hnn22` | `0 6 * * *` Africa/Casablanca |
| Threads webhook | `B22WGiYPuEeCMzjPk` | Fires `ingest-leads?platform=threads` |
| Instagram task | `2AQ1GZEJweccCbL8O` | **DISABLED** as of 2026-05-31 (owner asked for Threads-only) |
| Instagram schedule | `L8Y7pX8tXrQdNFpAv` | **DISABLED** |
| Instagram webhook | `IWEeFXW8cohagYh1h` | **DISABLED** |

Each task has `maxTotalChargeUsd: 0.5` as a hard safety cap. Budget target: ≤$15/month.

## Current keywords (Threads)

Mix of artists looking for help + producers struggling to sell:
- Artists: `need a music producer`, `looking for beats`, `need a beatmaker`, `need my song mixed`, `need mastering`, `looking for audio engineer`, `need a beat`, `podcast audio editing`
- Producers: `selling beats`, `how to sell beats`, `no one buys my beats`, `buy my beats`

To change keywords, update the task input via `PUT /v2/actor-tasks/G02OeSRH3YEldRKrm/input`.

## Edge Function filter logic (`isMusicLead`)

Each post must have **at least one MUSIC term AND one SERVICE term**, and zero NEGATIVE terms.
- MUSIC: beat, beats, beatmaker, producer, rap, rapper, song, track, album, ep, mixtape, vocals, instrumental, indie music, hip hop, trap, r&b, music, recording, studio, etc.
- SERVICE: producer, mixing, mastering, audio engineer, sound engineer, editing, podcast, collab, etc.
- NEGATIVE (auto-rejects): video editor, website, logo, graphic design, photographer, wedding, etc.

This stops generic "need a producer" posts about podcasts/film/web from spamming Telegram.

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

## Current Status (as of 2026-05-31)

### ✅ Working
- Apify Threads scraper running daily at 6:00 AM Morocco time
- Supabase Edge Function `ingest-leads` deployed and tested end-to-end
- Telegram bot @ProducerLeadsbot delivering leads with inline buttons
- 48-hour freshness filter + music-relevance filter both active
- Batch header messages separating daily runs
- Dedup via `post_id` so the same lead never gets Telegram'd twice
- Dashboard reads from Supabase (no longer hits Threads API)
- Hard cost cap of $0.50/run; budget target ≤$15/month
- Estimated output: ~50–80 leads/day, ~$10–14/month

### 🪦 Deprecated / Removed
- ❌ Threads official API integration — replaced by Apify scraping
- ❌ Meta business verification — denied, no longer pursued
- ❌ Meta App Review submission — abandoned with the API pivot
- ❌ Instagram hashtag scraper — disabled per owner request (Threads-only focus)
- ❌ Per-category keyword filtering on dashboard — replaced by platform filter

### ⏳ Future / Optional
- Re-enable Instagram scraper if Threads volume isn't enough
- Hook up Google OAuth + onboarding to turn this into a multi-user product
- Add a "mark as contacted" toggle per lead so the dashboard shows progress

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
