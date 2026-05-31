import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!
const CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')!
const APIFY_TOKEN = Deno.env.get('APIFY_API_TOKEN')!

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

function within48h(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 48 * 3_600_000
}

// Only keep posts that mention music-making, beats, audio engineering, or podcast audio editing.
// We require at least one MUSIC term AND one SERVICE term to filter out generic "need a producer"
// posts about podcasts, film, video, etc. that aren't audio-related.
const MUSIC_TERMS = [
  'beat','beats','beatmaker','producer','rap','rapper','song','songs','track','tracks',
  'album','ep','mixtape','singer','vocalist','vocals','instrumental','melody','hook',
  'verse','artist','musician','indie music','hip hop','hiphop','trap','r&b','rnb',
  'afrobeat','drill','pop','music','recording','studio','demo','rhymes','bars',
]
const SERVICE_TERMS = [
  'producer','producing','beatmaker','beat maker','mixing','mix','mixed','mastering',
  'master','mastered','audio engineer','sound engineer','engineer','recorded','recording',
  'edit','editing','editor','podcast','beats','beat','collab','collaboration',
]
const NEGATIVE_TERMS = [
  'video editor','video editing','website','logo','graphic design','illustrator',
  'photographer','3d model','app developer','copywriter','seo','tiktok edit',
  'reel edit','wedding','event planner',
]

function isMusicLead(text: string): boolean {
  const t = text.toLowerCase()
  if (NEGATIVE_TERMS.some(n => t.includes(n))) return false
  const hasMusic = MUSIC_TERMS.some(w => t.includes(w))
  const hasService = SERVICE_TERMS.some(w => t.includes(w))
  return hasMusic && hasService
}

function extractEmail(text: string): string | null {
  return text?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] ?? null
}

function normalizeThreads(item: any) {
  const username = item.username ?? item.author?.username ?? ''
  // item.date is ISO string; item.timestamp is Unix seconds — convert accordingly
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function sendTelegram(lead: any): Promise<{ ok: boolean; error?: string }> {
  const icon = lead.platform === 'threads' ? '🧵' : '📸'
  const platformLabel = lead.platform === 'threads' ? 'Threads' : 'Instagram'
  const snippet = lead.post_text.length > 220
    ? lead.post_text.slice(0, 220) + '…'
    : lead.post_text

  const lines = [
    `🎵 <b>New Lead · ${platformLabel}</b>`,
    ``,
    `<i>"${escapeHtml(snippet)}"</i>`,
    ``,
    `👤 @${escapeHtml(lead.username)} · ${timeAgo(lead.posted_at)}`,
  ]
  if (lead.email) lines.push(`📧 ${lead.email}`)

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
  const res = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&format=json&clean=true`
  )
  if (!res.ok) return []
  return await res.json()
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const platform = new URL(req.url).searchParams.get('platform') ?? 'threads'
  const body = await req.json()

  // Apify webhook sends { resource: { defaultDatasetId: "..." } }
  // Fetch the actual items from the dataset
  let items: any[] = []
  const datasetId = body?.resource?.defaultDatasetId
  if (datasetId) {
    items = await fetchDatasetItems(datasetId)
  } else {
    // Fallback: body is already an array of items
    items = Array.isArray(body) ? body : (body.data ?? body.items ?? [])
  }

  let saved = 0, skipped = 0, telegramSent = 0, telegramFailed = 0
  const errors: string[] = []
  let batchHeaderSent = false

  async function sendBatchHeader() {
    const now = new Date()
    const dateStr = now.toLocaleString('en-GB', {
      timeZone: 'Africa/Casablanca',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
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
  }

  for (const item of items) {
    const lead = platform === 'instagram' ? normalizeInstagram(item) : normalizeThreads(item)

    if (!lead.username || !lead.post_text) continue
    if (!within48h(lead.posted_at)) { skipped++; continue }
    if (!isMusicLead(lead.post_text)) { skipped++; continue }

    // Insert; if already existed, .data will be null and we skip Telegram
    const { data, error } = await supabase
      .from('leads')
      .upsert(lead, { onConflict: 'post_id', ignoreDuplicates: true })
      .select()

    if (error) {
      errors.push(`db: ${error.message}`)
      continue
    }

    // Only send Telegram for newly inserted rows
    if (data && data.length > 0) {
      saved++
      // Send the batch header before the first lead of this batch
      if (!batchHeaderSent) {
        await sendBatchHeader()
        batchHeaderSent = true
        await new Promise(r => setTimeout(r, 350))
      }
      const result = await sendTelegram(lead)
      if (result.ok) telegramSent++
      else { telegramFailed++; errors.push(`tg: ${result.error}`) }
      await new Promise(r => setTimeout(r, 350))
    }
  }

  return new Response(JSON.stringify({
    saved, skipped, telegramSent, telegramFailed,
    errors: errors.slice(0, 5),
  }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
