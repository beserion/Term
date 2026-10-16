const https = require('https');

async function main() {
  const loginRes = await fetch('https://api.blackskyqore.com/api/Auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'depo@geminimar.com', password: 'BlueHub1!' })
  });
  const { token } = await loginRes.json();
  const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json' };

  const bRes = await fetch('https://api.blackskyqore.com/api/terminal/Packing/BoardData/148', { headers });
  const bData = await bRes.json();
  console.log('BoardData 148 Raw:');
  console.log(JSON.stringify(bData, null, 2));
}

main().catch(console.error);
