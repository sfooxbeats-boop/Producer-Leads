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
  'BUYER               - wants beats, mixing, mastering, or audio/podcast editing. A real customer.',
  'STRUGGLING_PRODUCER - a producer struggling to sell beats or find clients. Fits the site.',
  'PROMOTER            - advertising their own beats or services, or hunting artists to place beats with.',
  'IRRELEVANT          - not about music or audio services.',
  '',
  'STEP 3 - For BUYER or STRUGGLING_PRODUCER only, write a DM. Otherwise dm is an empty string.',
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

  for (let attempt = 0; attempt < 2; attempt++) {
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
        await new Promise(r => setTimeout(r, 3000))
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
  STRUGGLING_PRODUCER: '🎹 <b>PRODUCER LEAD</b>',
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

  // Pass 2 — read intent, ten posts per call.
  const BATCH = 10
  for (let i = 0; i < candidates.length; i += BATCH) {
    const slice = candidates.slice(i, i + BATCH)
    const verdicts = await analyzeBatch(slice.map(l => l.post_text))
    slice.forEach((lead, k) => Object.assign(lead, verdicts[k]))
    if (i + BATCH < candidates.length) await new Promise(r => setTimeout(r, 4500))
  }

  // Pass 3 — save and notify only the leads worth contacting.
  const KEEP = ['BUYER', 'STRUGGLING_PRODUCER', 'UNREVIEWED']
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

  return new Response(JSON.stringify({ ...stats, analyzed: candidates.length, rejectedBy }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
