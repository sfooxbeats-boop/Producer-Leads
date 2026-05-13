/**
 * Producer Leads — Threads API Token Setup
 *
 * Run this once to connect your Threads account to the app:
 *   node get-threads-token.js
 *
 * It will:
 *   1. Open your browser to the Threads authorization page
 *   2. Wait for you to log in and click "Allow"
 *   3. Exchange the code for a long-lived token (valid 60 days)
 *   4. Save it to your .env file automatically
 */

const http = require('http');
const { exec } = require('child_process');
const fs   = require('fs');
const path = require('path');

const APP_ID       = '2830179424008862';
const APP_SECRET   = 'a84b3707ac26a07d311d6901ecf79d22';
const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPE        = 'threads_basic,threads_keyword_search';

const AUTH_URL =
  `https://threads.net/oauth/authorize` +
  `?client_id=${APP_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&response_type=code`;

// ─── Step 1: open browser ────────────────────────────────────────────────────
function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : `open "${url}"`;
  exec(cmd);
}

// ─── Step 2: exchange auth code for short-lived token ────────────────────────
async function getShortLivedToken(code) {
  const res = await fetch('https://graph.threads.net/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     APP_ID,
      client_secret: APP_SECRET,
      grant_type:    'authorization_code',
      redirect_uri:  REDIRECT_URI,
      code,
    }),
  });
  return res.json();
}

// ─── Step 3: exchange short-lived token for 60-day token ─────────────────────
async function getLongLivedToken(shortToken) {
  const res = await fetch(
    `https://graph.threads.net/access_token` +
    `?grant_type=th_exchange_token` +
    `&client_secret=${APP_SECRET}` +
    `&access_token=${shortToken}`
  );
  return res.json();
}

// ─── Step 4: write token to .env ─────────────────────────────────────────────
function saveTokenToEnv(token) {
  const envPath = path.join(__dirname, '.env');
  let content = fs.readFileSync(envPath, 'utf-8');

  if (content.includes('EXPO_PUBLIC_THREADS_ACCESS_TOKEN=')) {
    content = content.replace(
      /EXPO_PUBLIC_THREADS_ACCESS_TOKEN=.*/,
      `EXPO_PUBLIC_THREADS_ACCESS_TOKEN=${token}`
    );
  } else {
    content += `\nEXPO_PUBLIC_THREADS_ACCESS_TOKEN=${token}\n`;
  }

  fs.writeFileSync(envPath, content, 'utf-8');
}

// ─── Main server ─────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, 'http://localhost:3000');

  // Meta may redirect with an error
  const error = urlObj.searchParams.get('error');
  if (error) {
    console.error('\n❌ Meta returned an error:', error, urlObj.searchParams.get('error_description'));
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end(`<h2>Error: ${error}</h2><p>${urlObj.searchParams.get('error_description')}</p>`);
    server.close();
    process.exit(1);
  }

  const code = urlObj.searchParams.get('code');
  if (!code) return; // ignore unrelated requests (favicon, etc.)

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <html><body style="font-family:sans-serif;padding:40px;background:#0A0A0A;color:white;">
      <h2 style="color:#8B5CF6">✅ Authorized!</h2>
      <p>Saving your token... you can close this window.</p>
    </body></html>
  `);
  server.close();

  try {
    console.log('\n✅ Got authorization code!');
    console.log('📡 Exchanging for access token...\n');

    const shortData = await getShortLivedToken(code);
    if (shortData.error) throw new Error(JSON.stringify(shortData.error));
    console.log('✅ Got short-lived token');

    console.log('📡 Upgrading to 60-day token...\n');
    const longData = await getLongLivedToken(shortData.access_token);
    if (longData.error) throw new Error(JSON.stringify(longData.error));
    console.log('✅ Got long-lived token (valid 60 days)');

    saveTokenToEnv(longData.access_token);

    console.log('\n🎉 Done! Token saved to your .env file.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Next step: restart your Expo server');
    console.log('  → Stop it with Ctrl+C');
    console.log('  → Run: npx expo start --clear');
    console.log('  → Your dashboard will now show REAL leads from Threads!\n');

  } catch (err) {
    console.error('\n❌ Something went wrong:', err.message);
  }

  process.exit(0);
});

server.listen(3000, () => {
  console.log('');
  console.log('🎯 Producer Leads — Threads API Setup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Opening your browser to the Threads login page...');
  console.log('Log in with your Threads account and click "Allow".\n');
  openBrowser(AUTH_URL);
  console.log('Waiting for authorization...');
  console.log('(If the browser did not open, paste this URL manually:)');
  console.log(AUTH_URL + '\n');
});
