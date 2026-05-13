import { KEYWORDS, MATCH_TAGS } from './keywords';
import { MOCK_LEADS } from './mockLeads';

const THREADS_BASE = 'https://graph.threads.net/v1.0';

// This is YOUR personal Threads access token (you add it to .env).
// It allows the app to search all public Threads posts.
const ACCESS_TOKEN = process.env.EXPO_PUBLIC_THREADS_ACCESS_TOKEN;

// Whether a real Threads token is available
export const HAS_THREADS_TOKEN =
  !!ACCESS_TOKEN && ACCESS_TOKEN !== 'YOUR_THREADS_TOKEN_HERE';

export type ThreadsPost = {
  id: string;
  text: string;
  timestamp: string;
  username: string;
  permalink: string;
  match_tag: string;
  threads_url: string;
  instagram_url: string;
};

// Search Threads for a single keyword and return matching posts
async function searchByKeyword(keyword: string): Promise<any[]> {
  if (!ACCESS_TOKEN) {
    console.warn('EXPO_PUBLIC_THREADS_ACCESS_TOKEN is not set in .env');
    return [];
  }

  const params = new URLSearchParams({
    q: keyword,
    type: 'RECENT',
    fields: 'id,text,timestamp,username,permalink',
    access_token: ACCESS_TOKEN,
    limit: '25',
  });

  const response = await fetch(`${THREADS_BASE}/keyword_search?${params}`);

  if (!response.ok) {
    console.error(`Threads API error for "${keyword}": ${response.status}`);
    return [];
  }

  const json = await response.json();
  return json.data ?? [];
}

// Fetch leads for all of the user's selected categories.
// Searches all relevant keywords, deduplicates, and sorts by newest first.
// If no Threads token is configured, returns mock data so the UI still works.
export async function fetchLeadsForCategories(categories: string[]): Promise<ThreadsPost[]> {
  if (!HAS_THREADS_TOKEN) {
    // Filter mock data based on categories the user picked
    const tags = new Set(categories.map(c => MATCH_TAGS[c]).filter(Boolean));
    const filtered = MOCK_LEADS.filter(lead => tags.has(lead.match_tag));
    return filtered.length > 0 ? filtered : MOCK_LEADS;
  }

  const seenIds = new Set<string>();
  const results: ThreadsPost[] = [];

  for (const category of categories) {
    const keywords = KEYWORDS[category] ?? [];
    const tag = MATCH_TAGS[category] ?? category;

    for (const keyword of keywords) {
      try {
        const posts = await searchByKeyword(keyword);

        for (const post of posts) {
          if (!seenIds.has(post.id) && post.text && post.username) {
            seenIds.add(post.id);
            results.push({
              id: post.id,
              text: post.text,
              timestamp: post.timestamp,
              username: post.username,
              permalink: post.permalink ?? '',
              match_tag: tag,
              // Threads username = Instagram username (they share the same account)
              threads_url: `https://www.threads.net/@${post.username}`,
              instagram_url: `https://www.instagram.com/${post.username}`,
            });
          }
        }
      } catch (err) {
        console.error(`Failed to search "${keyword}":`, err);
      }
    }
  }

  // Sort newest first
  return results.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// How long ago a post was made — e.g. "2 hours ago"
export function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
