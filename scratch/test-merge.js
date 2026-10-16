const axios = require('../node_modules/axios');

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2N2NlNzJlOC1kZWVjLTQzMTUtOGQ3Zi1jZDgyZDE2ZWIxOTIiLCJlbWFpbCI6ImRlcG9AZ2VtaW5pbWFyLmNvbSIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWVpZGVudGlmaWVyIjoiNjdjZTcyZTgtZGVlYy00MzE1LThkN2YtY2Q4MmQxNmViMTkyIiwiY29tcGFueUlkIjoiMSIsImJyYW5jaElkIjoiMCIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6WyJBZG1pbiIsIlN1cGVyQWRtaW4iLCJXYXJlaG91c2VNYW5hZ2VyIl0sImV4cCI6MTc4ODk0NjQ3MCwiaXNzIjoiQXBwQXBpIiwiYXVkIjoiQXBwQXBpIn0.9ysEHvA9NtJi8zObt90gw0uR9J3a9hryC8ldWQCN6d8";

const client = axios.create({
  baseURL: 'https://api.blackskyqore.com/api',
  headers: {
    Authorization: `Bearer ${token}`
  }
});

async function check() {
  const [resOrdersList, resOrderlist] = await Promise.all([
    client.get('/terminal/Orders/List').catch(() => ({ data: { data: [] } })),
    client.get('/terminal/Orderlist?startRow=0&endRow=100').catch(() => ({ data: { order: [] } }))
  ]);

  const ordersList = resOrdersList.data?.data || [];
  const orderList = resOrderlist.data?.order || [];

  console.log("Orders/List count:", ordersList.length);
  console.log("Orderlist count:", orderList.length);

  const productCountMap = {};
  for (const o of ordersList) {
    productCountMap[o.orderId || o.id] = o.productCount;
  }

  const merged = orderList.map(item => ({
    id: item.id || item.orderId,
    orderNo: item.orderNo,
    rfqNo: item.rfqNo,
    vesselName: item.vesselName,
    partnerName: item.partnerName,
    status: item.orderStatus,
    productCount: productCountMap[item.id] || item.productCount || 0
  }));

  console.log("Merged sample:", JSON.stringify(merged[0], null, 2));
}

check();
