const https = require('https');

async function main() {
  const loginRes = await fetch('https://api.blackskyqore.com/api/Auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'depo@geminimar.com', password: 'BlueHub1!' })
  });
  const { token } = await loginRes.json();
  const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json' };

  console.log('\n--- 1. Suppliers for Order 148 ---');
  const supRes = await fetch('https://api.blackskyqore.com/api/terminal/Packing/Orders/148/Suppliers', { headers });
  console.log('Suppliers status:', supRes.status);
  const supData = await supRes.json();
  console.log('Suppliers data:', JSON.stringify(supData, null, 2));

  console.log('\n--- 2. BoardData for Order 148 ---');
  const bRes = await fetch('https://api.blackskyqore.com/api/terminal/Packing/BoardData/148', { headers });
  const bData = await bRes.json();
  console.log('Unpacked items:', bData.data?.unpackedItems);
  console.log('Boxes count:', bData.data?.boxes?.length);
  console.log('Pallets count:', bData.data?.pallets?.length);
  bData.data?.pallets?.forEach(p => {
    console.log(`Pallet ${p.id} (${p.palletNo}): boxes =`, p.boxes?.map(b => ({ id: b.id, name: b.boxName, itemsCount: b.items?.length })));
  });
}

main().catch(console.error);
