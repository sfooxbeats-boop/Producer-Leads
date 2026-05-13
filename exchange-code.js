const readline = require('readline');
const fs = require('fs');

const APP_ID     = '2830179424008862';
const APP_SECRET = 'a84b3707ac26a07d311d6901ecf79d22';
const REDIRECT   = 'https://httpbin.org/get';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log('\n==============================================');
console.log('After clicking Allow on Threads:');
console.log('Copy the ENTIRE URL from your browser bar');
console.log('It starts with: https://httpbin.org/get?code=');
console.log('==============================================\n');

rl.question('Paste the full browser URL here and press Enter: ', async (input) => {
  rl.close();
  input = input.trim().replace(/^["']|["']$/g, '');

  // Extract code from URL or use directly if just the code was pasted
  let code = input;
  if (input.includes('code=')) {
    const match = input.match(/[?&]code=([^&#]+)/);
    if (match) code = match[1];
  }

  console.log('\n⏳ Exchanging code...');
  try {
    const body = `client_id=${APP_ID}&client_secret=${APP_SECRET}&grant_type=authorization_code&redirect_uri=${encodeURIComponent(REDIRECT)}&code=${code}`;
    const r1 = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const short = await r1.json();
    if (short.error) throw new Error(short.error.message);
    console.log('✅ Got token!');

    console.log('⏳ Upgrading to 60-day token...');
    const r2 = await fetch(`https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${APP_SECRET}&access_token=${short.access_token}`);
    const long = await r2.json();
    if (long.error) throw new Error(long.error.message);

    let env = fs.readFileSync('.env', 'utf8');
    env = env.replace(/EXPO_PUBLIC_THREADS_ACCESS_TOKEN=.*/, `EXPO_PUBLIC_THREADS_ACCESS_TOKEN=${long.access_token}`);
    fs.writeFileSync('.env', env);

    console.log(`\n🎉 DONE! Token valid for ${Math.round(long.expires_in / 86400)} days — saved to .env`);
    console.log('👉 Restart Expo: Ctrl+C in the Expo window → npx expo start --clear\n');
  } catch(e) {
    console.error('❌ Error:', e.message);
    console.log('\nRun the script again and paste the URL faster next time.');
  }
});
