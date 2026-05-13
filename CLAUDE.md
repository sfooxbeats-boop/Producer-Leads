# Producer Leads — Project Context for Claude

This file gives Claude (or any developer) the context needed to work on this codebase quickly.

## What this app is

**Producer Leads** is a mobile + web app that helps music producers, beatmakers, and sound engineers find potential clients. It searches Threads (Meta's social app) for public posts where people ask for music services (beats, mixing, production), and shows them on a dashboard with the author's Threads + Instagram links.

Owner: sfooxbeats (sfooxbeats@gmail.com) — **complete beginner** in app development. Explanations should be plain-language and detailed.

## Tech Stack

| Layer | Tool | Version |
|-------|------|---------|
| Framework | Expo (React Native) | SDK 54 |
| Language | TypeScript | 5.9 |
| Routing | Expo Router (file-based) | 6.x |
| Styling | NativeWind v4 + Tailwind CSS 3 | 4.2.3 / 3.4 |
| Auth + DB | Supabase | latest |
| External API | Meta Threads API | v1.0 |
| Native arch | New Architecture enabled | yes |

## Folder Structure

```
app/                    # Screens (file-based routing)
  index.tsx             # Entry — redirects based on auth state
  _layout.tsx           # Root layout, watches auth state
  (auth)/sign-in.tsx    # Google sign in (handles web + Expo Go native flows)
  (app)/dashboard.tsx   # Main leads screen
  (app)/settings.tsx    # Edit profile / sign out
  onboarding.tsx        # 3-step profile setup
  auth/callback.tsx     # OAuth redirect handler

components/
  LeadCard.tsx          # Individual lead post card

lib/
  supabase.ts           # Supabase client + auth helpers + profile helpers
  threads.ts            # Threads API keyword search + lead aggregation
  keywords.ts           # Keyword lists per producer category

babel.config.js         # NativeWind v4 preset config (see Gotchas)
metro.config.js         # withNativeWind wrapper
tailwind.config.js      # Custom dark color palette
global.css              # Tailwind base + components + utilities
.env                    # Supabase + Threads credentials (gitignored)
.env.example            # Template — safe to commit
.npmrc                  # legacy-peer-deps=true (required for Expo Router peer conflicts)
SETUP_GUIDE.md          # Step-by-step setup instructions for the owner
```

## Environment Variables

All public vars MUST be prefixed `EXPO_PUBLIC_` for Expo to expose them:

```
EXPO_PUBLIC_SUPABASE_URL=https://hylrkrfmxsnocauibqnt.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
EXPO_PUBLIC_THREADS_ACCESS_TOKEN=...     # 60-day rolling token
```

## Common Commands

```bash
# Start dev server (for Expo Go on phone or web)
npx expo start
npx expo start --clear        # when caches go stale (most common fix)
npx expo start --tunnel       # if phone is on different WiFi

# Web only
npm run web

# Install a new package (USE THIS, not plain npm install)
npx expo install <package>    # picks SDK-compatible version automatically

# Production build (later, not yet)
npx eas build --platform ios
npx eas build --platform android
```

## Database Schema (Supabase)

Two tables — created via Supabase Management API. SQL is in [SETUP_GUIDE.md](SETUP_GUIDE.md).

- `users` — producer profiles. RLS: users can only read/write their own row.
- `leads` — cached Threads posts (currently unused at runtime; dashboard hits Threads API directly).

## Key Conventions

- **Color palette** — dark theme. `bg #0A0A0A`, `card #1A1A1A`, `border #2A2A2A`, `accent #8B5CF6` (purple), `muted #6B7280`. Defined in tailwind.config.js.
- **TypeScript** — strict on. No `any` if avoidable.
- **No comments unless WHY is non-obvious** — see global guidance.
- **Threads username = Instagram username** — they share an account. Safe to link both directly.

## Gotchas / Known Issues

1. **Directory name "Producer Leads" has a space** — `npx create-expo-app .` fails because of it. Workaround used: create in temp folder `producer-leads`, then move files into `Producer Leads`.

2. **legacy-peer-deps is required** — expo-router 6.x has a strict React peer dep. `.npmrc` already sets `legacy-peer-deps=true`. Don't remove it.

3. **NativeWind v4 babel config** — `nativewind/babel` is a **preset**, NOT a plugin. Wrong:
   ```js
   plugins: ['nativewind/babel']   // ❌ ".plugins is not a valid Plugin property"
   ```
   Right:
   ```js
   presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel']
   ```

4. **NativeWind v4 requires `react-native-worklets`** — must be installed alongside nativewind. Caused "Cannot find module 'react-native-worklets/plugin'" error.

5. **Stale node_modules after moving folders** — if babel errors appear after files were moved or renamed: delete `node_modules` + `package-lock.json`, run `npm install`, restart with `--clear`.

6. **OAuth on Expo Go vs web** — `sign-in.tsx` branches on `Platform.OS`:
   - Web: standard `signInWithOAuth` with browser redirect
   - Native: `WebBrowser.openAuthSessionAsync` + manual `setSession` from URL fragment
   - Requires `expo-auth-session` for `makeRedirectUri`

7. **Threads access token expires every 60 days** — set a reminder. Refresh via Meta Graph API Explorer.

## Current Status

- ✅ Project skeleton scaffolded, all packages installed
- ✅ Supabase URL + anon key configured in `.env`
- ✅ Supabase `users` + `leads` tables created with RLS policies
- ✅ Supabase `mailer_autoconfirm = true` (email signup skips confirmation)
- ✅ All screens built and styled (sign-in, onboarding, dashboard, settings)
- ✅ Code pushed to GitHub: https://github.com/sfooxbeats-boop/Producer-Leads
- ✅ App runs on Expo Go
- ✅ **Dev mode active** — auth + onboarding bypassed; app opens straight to dashboard
- ✅ **Mock leads data** — dashboard shows realistic sample posts when no Threads token
- ⏳ **Google OAuth** — not yet configured in Google Cloud Console / Supabase Auth
- ✅ **Threads API token** — Working 60-day token in `.env`. Meta app: Producer Leads (Threads App ID: 2830179424008862). Token expires ~July 2026. Use `node exchange-code.js` to renew.
- ⏳ **Meta App Review** — required before public users can use the app (2–4 weeks)

## Dev Mode (Auth Bypass)

To get the app running on a phone without setting up Google/Threads first, auth was bypassed:

- [app/index.tsx](app/index.tsx) — `<Redirect href="/(app)/dashboard" />`
- [app/_layout.tsx](app/_layout.tsx) — no auth gate, just renders Stack
- [app/(app)/dashboard.tsx](app/(app)/dashboard.tsx) — uses hardcoded `DEFAULT_CATEGORIES` instead of Supabase profile
- [app/(app)/settings.tsx](app/(app)/settings.tsx) — placeholder, no profile editing
- [lib/threads.ts](lib/threads.ts) — falls back to [lib/mockLeads.ts](lib/mockLeads.ts) when `HAS_THREADS_TOKEN` is false

**To re-enable auth flow:**
1. Restore `app/index.tsx` to the session-checking version (see git history)
2. Restore `app/_layout.tsx` redirect logic
3. Restore `app/(app)/dashboard.tsx` to fetch user profile from Supabase
4. Restore `app/(app)/settings.tsx` full version with profile editing

## User Preferences (from past conversations)

- Update this CLAUDE.md and push to GitHub after every major change to the app.
- Explain like a beginner — assume zero prior software engineering knowledge.
- Will deploy as web app first (no App Store), then mobile later.

## Useful References

- [SETUP_GUIDE.md](SETUP_GUIDE.md) — owner-facing setup walkthrough
- Supabase project: https://supabase.com/dashboard/project/hylrkrfmxsnocauibqnt
- GitHub repo: https://github.com/sfooxbeats-boop/Producer-Leads
- Threads API docs: https://developers.facebook.com/docs/threads/keyword-search/
