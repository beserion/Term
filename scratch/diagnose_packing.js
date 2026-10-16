const https = require('https');

async function test() {
  const loginRes = await fetch('https://api.blackskyqore.com/api/Auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'depo@geminimar.com', password: 'BlueHub1!' })
  });
  const { token } = await loginRes.json();
  const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json' };

  const [packingRes, ordersListRes] = await Promise.all([
    fetch('https://api.blackskyqore.com/api/terminal/Packing/Orders', { headers }).then(r => r.json()).catch(() => []),
    fetch('https://api.blackskyqore.com/api/terminal/Orders/List?pageSize=1000', { headers }).then(r => r.json()).catch(() => [])
  ]);

  const packingData = Array.isArray(packingRes) ? packingRes : (packingRes.data || []);
  const ordersListData = Array.isArray(ordersListRes) ? ordersListRes : (ordersListRes.data || []);

  console.log('packingData count:', packingData.length);
  console.log('ordersListData count:', ordersListData.length);

  function isPurchaseOrder(orderNo) {
    if (!orderNo) return false;
    const upper = String(orderNo).trim().toUpperCase();
    return upper.startsWith('PO-') || upper.startsWith('PO/');
  }

  const validPacking = packingData.filter(p => !isPurchaseOrder(p.orderNo));
  console.log('validPacking count (PO filtered out):', validPacking.length);

  const activePacking = validPacking.filter(p => !p.isPackingCompleted && (p.packedRatio === undefined || p.packedRatio < 100));
  console.log('activePacking count (< 100%):', activePacking.length);
}

test().catch(console.error);
