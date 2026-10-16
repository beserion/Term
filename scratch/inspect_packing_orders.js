const https = require('https');

async function main() {
  const loginRes = await fetch('https://api.blackskyqore.com/api/Auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'depo@geminimar.com', password: 'BlueHub1!' })
  });
  const { token } = await loginRes.json();
  const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json' };

  const res = await fetch('https://api.blackskyqore.com/api/terminal/Packing/Orders', { headers });
  const data = await res.json();
  console.log('Packing Orders Sample:');
  const items = Array.isArray(data) ? data : (data.data || []);
  console.log('Count:', items.length);
  if (items.length > 0) {
    console.log('Sample item keys:', Object.keys(items[0]));
    console.log('Sample item:', JSON.stringify(items[0], null, 2));
  }
}

main().catch(console.error);
