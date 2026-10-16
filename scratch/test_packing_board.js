const https = require('https');

async function main() {
  const loginRes = await fetch('https://api.blackskyqore.com/api/Auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'depo@geminimar.com', password: 'BlueHub1!' })
  });
  const { token } = await loginRes.json();
  const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json' };

  console.log('\n--- Testing POST /terminal/Packing/RemoveItem/123 ---');
  // Just try testing options or check swagger definition for RemoveItem
  const res = await fetch('https://api.blackskyqore.com/api/terminal/Packing/RemoveItem/123', {
    method: 'POST',
    headers,
    body: JSON.stringify({})
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response body:', text);

  // Check BoardData again after calling RemoveItem
  const bRes = await fetch('https://api.blackskyqore.com/api/terminal/Packing/BoardData/148', { headers });
  const bData = await bRes.json();
  console.log('\nBoardData 148 after remove:');
  const plt = bData.data?.pallets?.[0];
  console.log('Pallet boxes count:', plt?.boxes?.length);
  plt?.boxes?.forEach(b => {
    console.log(`Box ${b.id} (${b.boxName}): items count = ${b.items?.length}`);
  });
}

main().catch(console.error);
