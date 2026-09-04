import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')!
const APIFY_TOKEN = Deno.env.get('APIFY_API_TOKEN')!
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')!

// How far back a post can be and still count as a lead.
const FRESHNESS_DAYS = 7

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function withinWindow(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < FRESHNESS_DAYS * 24 * 3_600_000
}

function extractEmail(text: string): string | null {
  return text?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] ?? null
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function normalizeThreads(item: any) {
  const username = item.username ?? item.author?.username ?? ''
  const posted_at = item.date
    ?? (item.timestamp ? new Date(item.timestamp * 1000).toISOString() : new Date().toISOString())
  return {
    post_id: `threads_${item.postId ?? item.id}`,
    platform: 'threads',
    username,
    post_text: item.text ?? '',
    post_url: item.url ?? `https://www.threads.net/@${username}`,
    instagram_url: `https://www.instagram.com/${username}`,
    email: extractEmail(item.text ?? ''),
    match_tag: 'Music Lead',
    posted_at,
  }
}

function normalizeInstagram(item: any) {
  const username = item.ownerUsername ?? item.username ?? ''
  const bio = item.ownerBio ?? item.biography ?? ''
  return {
    post_id: `instagram_${item.id}`,
    platform: 'instagram',
    username,
    post_text: item.caption ?? item.text ?? '',
    post_url: item.url ?? `https://www.instagram.com/p/${item.shortCode}/`,
    instagram_url: `https://www.instagram.com/${username}`,
    email: item.businessEmail ?? item.publicEmail ?? extractEmail(bio) ?? extractEmail(item.caption ?? ''),
    match_tag: 'Music Lead',
    posted_at: item.timestamp ?? item.takenAt ?? new Date().toISOString(),
  }
}

// ─── Intent analysis ──────────────────────────────────────────────────────────
// Keyword matching cannot separate "I need beats" from "check out my beat", so
// every surviving post is read by a model that works out which direction the
// request runs and writes the opener. Batched to stay inside the free tier.

const SYSTEM_PROMPT = [
  'You screen Threads posts for sfoox, a music producer and audio engineer who offers',
  'beat making, mixing, mastering, podcast and audio editing, and runs a site that helps',
  'producers sell more beats.',
  '',
  'STEP 1 - Work out the DIRECTION of each post. This is the whole job:',
  '- Poster asking to RECEIVE something (beats, links, samples, a mix, help)? BUYER.',
  '- Poster offering to GIVE something (their beat, their services, their catalogue)? PROMOTER.',
  '',
  'Phrases like "post your links", "send me your beats", "DM me samples", "drop your best beat",',
  '"who got beats" mean the poster wants to RECEIVE. That is a BUYER.',
  'Phrases like "check out my beat", "looking for artists", "free for profit", "link in bio",',
  '"prod by me", and #typebeat or #beatstars promo mean the poster wants to GIVE. That is a PROMOTER.',
  '',
  'STEP 2 - Pick exactly one verdict per post:',
  'BUYER      - wants to RECEIVE beats, mixing, mastering, or audio/podcast editing.',
  '             A customer for the services.',
  'PRODUCER   - makes beats and is trying to sell them. Covers type beat promo posts,',
  '             "beats for sale", "buy my beats", producers hunting artists to place beats',
  '             with, and producers openly struggling to sell. All of these are customers',
  '             for the site that helps producers sell more beats.',
  'IRRELEVANT - everything else. This includes people touting the SAME services sfoox sells',
  '             (mixing engineers, mastering engineers, podcast editors advertising for work),',
  '             job adverts and hiring posts, and general music chat with no request in it.',
  '',
  'A promoter posting their own beats is a PRODUCER, not IRRELEVANT. They are trying to sell,',
  'which is exactly what the site helps with. Only rule out someone who competes with sfoox.',
  '',
  'Watch for the word "beats" meaning the headphone brand rather than music. A post selling',
  '"Beats Solo", "Beats Studio", "beats buds" or "beats headphones", especially with a price,',
  'a condition, or a place to collect from, is second hand electronics. Mark it IRRELEVANT.',
  'A real beat seller talks about type beats, exclusives, leases, placements, or a producer tag.',
  '',
  'STEP 3 - For BUYER or PRODUCER, write a DM. For IRRELEVANT, dm is an empty string.',
  'Match the DM to the verdict:',
  '- BUYER: offer the specific thing they asked for.',
  '- PRODUCER: never offer to sell them beats, they make their own. Ask about their sales,',
  '  their release routine, or how the beat is moving. Curiosity, not a pitch.',
  '',
  'DM rules:',
  '- 1 to 2 sentences, under 28 words',
  '- lowercase, like a text between two people',
  '- name the specific thing THIS person said they need',
  '- end with exactly ONE question, easy to answer',
  '- start with "saw" when referring to their post. Never "heard".',
  '- NEVER claim you already did something. No "sent you", "attached", "checked out your page",',
  '  "just listened". You have not contacted them yet.',
  '- NEVER invent credentials, past clients, or results',
  '- no adverbs, no em dashes, no exclamation marks',
  '- write as one person, never "we" or "our team" or "our site"',
  '- banned openers: "I came across", "I would love to", "hope this finds you", "quick question"',
  '',
  'You receive a JSON array of posts, each with an "i" index and "text".',
  'Reply with ONLY a raw JSON array, one object per input post, same order:',
  '[{"i":0,"verdict":"...","why":"8 words max","dm":"..."}]',
].join('\n')

type Verdict = { verdict: string; why: string; dm: string }

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent'

async function analyzeBatch(texts: string[]): Promise<Verdict[]> {
  const payload = texts.map((t, i) => ({ i, text: t.slice(0, 900) }))

  // 4 attempts with exponential backoff (2s, 4s, 8s). Gemini's free tier is
  // 15 requests/minute; a burst of batches from a big scrape (or overlapping
  // with manual testing against the same key) can trip that, and a single
  // quick retry is not enough to clear a real rate limit.
  const MAX_ATTEMPTS = 4
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'x-goog-api-key': GEMINI_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: JSON.stringify(payload) }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 8000,
            responseMimeType: 'application/json',
          },
        }),
      })
      if (!res.ok) {
        console.error('Gemini HTTP', res.status, (await res.text()).slice(0, 200))
        if (attempt < MAX_ATTEMPTS - 1) {
          await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt)))
        }
        continue
      }
      const j = await res.json()
      const arr = JSON.parse(j.candidates?.[0]?.content?.parts?.[0]?.text)
      // Re-align on the index the model echoed back, so one dropped item cannot
      // shift every following verdict onto the wrong post.
      return texts.map((_, i) => {
        const m = arr.find((x: any) => x.i === i)
        return m
          ? { verdict: m.verdict ?? 'UNREVIEWED', why: m.why ?? '', dm: m.dm ?? '' }
          : { verdict: 'UNREVIEWED', why: 'model skipped this post', dm: '' }
      })
    } catch (e) {
      console.error('Gemini error:', String(e).slice(0, 200))
      await new Promise(r => setTimeout(r, 3000))
    }
  }
  // Never drop leads silently: flag them so a human still gets to look.
  return texts.map(() => ({ verdict: 'UNREVIEWED', why: 'analysis failed', dm: '' }))
}

// ─── Telegram ─────────────────────────────────────────────────────────────────

const LABELS: Record<string, string> = {
  BUYER: '💰 <b>BUYER</b>',
  PRODUCER: '🎹 <b>WEBSITE LEAD</b>',
  STRUGGLING_PRODUCER: '🎹 <b>WEBSITE LEAD</b>', // legacy verdict, kept so old rows still render
  UNREVIEWED: '⚠️ <b>UNREVIEWED</b>',
}

async function sendTelegram(lead: any): Promise<{ ok: boolean; error?: string }> {
  const icon = lead.platform === 'threads' ? '🧵' : '📸'
  const platformLabel = lead.platform === 'threads' ? 'Threads' : 'Instagram'
  const snippet = lead.post_text.length > 220
    ? lead.post_text.slice(0, 220) + '…'
    : lead.post_text

  const lines = [
    `${LABELS[lead.verdict] ?? '🎵 <b>LEAD</b>'} · ${platformLabel}`,
    ``,
    `<i>"${escapeHtml(snippet)}"</i>`,
    ``,
    `👤 @${escapeHtml(lead.username)} · ${timeAgo(lead.posted_at)}`,
  ]
  if (lead.email) lines.push(`📧 ${lead.email}`)
  if (lead.dm) {
    lines.push(``, `💬 <b>DM to copy</b>`, `<code>${escapeHtml(lead.dm)}</code>`)
  } else {
    lines.push(``, `<i>no DM written (${escapeHtml(lead.why || 'unknown')})</i>`)
  }

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: lines.join('\n'),
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '📸 DM on Instagram', url: lead.instagram_url },
          { text: `${icon} View Post`, url: lead.post_url },
        ]],
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('Telegram send failed:', res.status, body)
    return { ok: false, error: `${res.status}: ${body}` }
  }
  return { ok: true }
}

async function fetchDatasetItems(datasetId: string): Promise<any[]> {
  // Apify can fire the webhook before the dataset is fully committed.
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&format=json&clean=true`
    )
    if (res.ok) {
      const data = await res.json()
      if (data.length > 0 || attempt === 2) return data
    }
    await new Promise(r => setTimeout(r, 10_000))
  }
  return []
}

const THREADS_TASK_ID = 'G02OeSRH3YEldRKrm'

// The actor bills $0.005 per post extracted, so most of a run's cost used to go on
// posts published weeks ago that the freshness filter then binned. Moving postedAfter
// forward after every run makes each run stop scrolling once it reaches posts it has
// already seen. The keyword list is rotated at the same time: maxTotalChargeUsd aborts
// a run mid-way, and without rotation the queries at the end of the list would never
// get their turn.
async function advanceTaskCursor(): Promise<string> {
  try {
    const base = `https://api.apify.com/v2/actor-tasks/${THREADS_TASK_ID}/input?token=${APIFY_TOKEN}`
    const cur = await fetch(base)
    if (!cur.ok) return 'read failed: ' + cur.status
    const input = await cur.json()

    const q: string[] = Array.isArray(input.searchQueries) ? input.searchQueries : []
    if (q.length > 1) input.searchQueries = [...q.slice(1), q[0]]

    // postedAfter tracks the FRESHNESS WINDOW, not the polling interval. Setting it to
    // "since the last run" looked right and returned nothing: Threads' search results are
    // not in date order, so the actor hit an old post early, set stoppedByPostedAfter and
    // gave up. Three consecutive runs scraped 0 posts having skipped 40 each. Dedup on
    // post_id already stops repeats, so this only has to exclude genuinely stale posts.
    input.postedAfter = new Date(Date.now() - FRESHNESS_DAYS * 24 * 3_600_000).toISOString()

    const put = await fetch(base, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    return put.ok ? input.postedAfter : 'write failed: ' + put.status
  } catch (e) {
    return 'error: ' + String(e).slice(0, 80)
  }
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const platform = new URL(req.url).searchParams.get('platform') ?? 'threads'
  const body = await req.json()

  let items: any[] = []
  const datasetId = body?.resource?.defaultDatasetId
  if (datasetId) {
    items = await fetchDatasetItems(datasetId)
  } else {
    items = Array.isArray(body) ? body : (body.data ?? body.items ?? [])
  }

  const stats = { scraped: items.length, stale: 0, duplicate: 0, rejected: 0, sent: 0, failed: 0 }
  const rejectedBy: Record<string, number> = {}

  // Pass 1 — cheap filters first, so the model only reads posts that could matter.
  const candidates: any[] = []
  const cutoff = new Date(Date.now() - FRESHNESS_DAYS * 24 * 3_600_000).toISOString()

  for (const item of items) {
    const lead = platform === 'instagram' ? normalizeInstagram(item) : normalizeThreads(item)
    if (!lead.username || !lead.post_text) continue
    if (!withinWindow(lead.posted_at)) { stats.stale++; continue }

    const { data: seenPost } = await supabase
      .from('leads').select('id').eq('post_id', lead.post_id).limit(1)
    if (seenPost && seenPost.length > 0) { stats.duplicate++; continue }

    const { data: seenUser } = await supabase
      .from('leads').select('id').eq('username', lead.username).gte('fetched_at', cutoff).limit(1)
    if (seenUser && seenUser.length > 0) { stats.duplicate++; continue }

    candidates.push(lead)
  }

  // Pass 2 — read intent, ten posts per call. 6.5s between batches keeps this
  // near 9 calls/minute even alone, leaving headroom under Gemini's 15/minute
  // free-tier limit for the local scraper and Apify to land close together,
  // or for manual testing against the same key while a run is in flight.
  const BATCH = 10
  for (let i = 0; i < candidates.length; i += BATCH) {
    const slice = candidates.slice(i, i + BATCH)
    const verdicts = await analyzeBatch(slice.map(l => l.post_text))
    slice.forEach((lead, k) => Object.assign(lead, verdicts[k]))
    if (i + BATCH < candidates.length) await new Promise(r => setTimeout(r, 6500))
  }

  // Pass 3 — save and notify only the leads worth contacting.
  const KEEP = ['BUYER', 'PRODUCER', 'STRUGGLING_PRODUCER', 'UNREVIEWED']
  let batchHeaderSent = false

  for (const lead of candidates) {
    if (!KEEP.includes(lead.verdict)) {
      stats.rejected++
      rejectedBy[lead.verdict] = (rejectedBy[lead.verdict] ?? 0) + 1
      continue
    }

    const { data, error } = await supabase
      .from('leads').upsert(lead, { onConflict: 'post_id', ignoreDuplicates: true }).select()
    if (error || !data || data.length === 0) continue

    if (!batchHeaderSent) {
      const dateStr = new Date().toLocaleString('en-GB', {
        timeZone: 'Africa/Casablanca',
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: `━━━━━━━━━━━━━━━━━━━━\n🚀 <b>NEW BATCH · ${platform.toUpperCase()}</b>\n📅 ${dateStr}\n━━━━━━━━━━━━━━━━━━━━`,
          parse_mode: 'HTML',
        }),
      })
      batchHeaderSent = true
      await new Promise(r => setTimeout(r, 350))
    }

    const result = await sendTelegram(lead)
    if (result.ok) stats.sent++
    else stats.failed++
    await new Promise(r => setTimeout(r, 350))
  }

  // Only advance Apify's own cursor/rotation when this call genuinely came from
  // Apify's webhook (a datasetId is present). Other sources -- like the local
  // Threads scraper, which also posts platform=threads -- must not touch it.
  const cursor = (platform === 'threads' && datasetId) ? await advanceTaskCursor() : 'n/a'

  return new Response(JSON.stringify({ ...stats, analyzed: candidates.length, rejectedBy, cursor }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
