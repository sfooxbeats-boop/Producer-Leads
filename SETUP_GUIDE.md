# Producer Leads — Setup Guide

Follow these steps in order. Each step links to exactly where you need to go.

---

## Step 1 — Create your Supabase database

1. Go to **supabase.com** and sign in (use the GitHub login button)
2. Click **New Project** → give it any name (e.g. "producer-leads") → choose a region close to you → set a database password → click Create
3. Wait ~2 minutes for your project to be ready
4. In the left sidebar go to **SQL Editor**
5. Click **New query**
6. Paste the following SQL and click **Run**:

```sql
-- Stores producer profiles
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  categories TEXT[],
  years_in_industry INTEGER,
  genres TEXT[],
  onboarding_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cached leads from Threads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  threads_post_id TEXT UNIQUE NOT NULL,
  author_username TEXT NOT NULL,
  author_display_name TEXT,
  author_avatar_url TEXT,
  content TEXT NOT NULL,
  relevant_categories TEXT[],
  match_tag TEXT,
  posted_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT now()
);
```

7. Go to **Settings → API** (left sidebar)
8. Copy **Project URL** and **anon public** key
9. Paste them into your `.env` file:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
   ```

---

## Step 2 — Enable Google Login in Supabase

1. In your Supabase project go to **Authentication → Providers → Google**
2. Toggle it **ON**
3. You need a Google Client ID and Secret. To get them:
   a. Go to **console.cloud.google.com**
   b. Create a new project (top left dropdown → New Project)
   c. Go to **APIs & Services → OAuth consent screen** → External → fill in app name + email → Save
   d. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   e. Application type: **Web application**
   f. Authorized redirect URI: add `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
      (replace YOUR_PROJECT_ID with your actual Supabase project ID)
   g. Copy the **Client ID** and **Client Secret**
4. Paste them into Supabase → Authentication → Google → Client ID + Client Secret → Save

---

## Step 3 — Get your Threads API token

1. Go to **developers.facebook.com** and sign in with your Facebook/Meta account
2. Click **My Apps → Create App**
3. Select **Business** as the app type → click Next
4. Give your app a name (e.g. "Producer Leads Dev") → fill in contact email → click Create
5. In your app dashboard, click **Add Product** → find **Threads API** → click Set Up
6. Go to **Threads API → Settings** → add your Threads account as a test user
7. Go to **Tools → Graph API Explorer**
8. Select your app from the dropdown
9. Click **Generate Access Token** → log in with your Threads account → accept permissions
10. Click **Extend Token** to get a long-lived token (valid 60 days)
11. Copy the token and paste into your `.env`:
    ```
    EXPO_PUBLIC_THREADS_ACCESS_TOKEN=EAA...
    ```

**Important:** This token expires every 60 days. Set a reminder to refresh it.

---

## Step 4 — Create your .env file

1. In your `Producer Leads` folder, find the file called `.env.example`
2. Make a copy of it and name the copy `.env` (no ".example" at the end)
3. Fill in your values from Steps 1–3
4. Save the file

---

## Step 5 — Run the app

Open VS Code → open the `Producer Leads` folder → open a Terminal (Terminal menu → New Terminal) → run:

```bash
npm run web
```

This will open the app in your browser at http://localhost:8081

---

## Step 6 — Deploy to web (make it live)

1. Push your code to GitHub (see below)
2. Go to **vercel.com** → New Project → Import your GitHub repo
3. Add your environment variables in Vercel's dashboard (same values from your .env)
4. Click Deploy — your app will be live at a URL like `https://producer-leads.vercel.app`

---

## Step 7 — Submit to Meta for App Review (to let other users in)

Before other producers can use your app (not just you), Meta needs to review it.

1. In your Meta Developer app, go to **App Review → Permissions and Features**
2. Request **threads_basic** — provide a description and video screencast
3. Request **threads_keyword_search** — same
4. Submit for review
5. Wait 2–4 weeks. They'll email you when approved.

---

## Pushing code to GitHub

In VS Code terminal:
```bash
git add .
git commit -m "Initial Producer Leads app"
git push -u origin main
```

If git asks for your name/email the first time:
```bash
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```
