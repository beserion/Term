const axios = require('../node_modules/axios');

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2N2NlNzJlOC1kZWVjLTQzMTUtOGQ3Zi1jZDgyZDE2ZWIxOTIiLCJlbWFpbCI6ImRlcG9AZ2VtaW5pbWFyLmNvbSIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWVpZGVudGlmaWVyIjoiNjdjZTcyZTgtZGVlYy00MzE1LThkN2YtY2Q4MmQxNmViMTkyIiwiY29tcGFueUlkIjoiMSIsImJyYW5jaElkIjoiMCIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6WyJBZG1pbiIsIlN1cGVyQWRtaW4iLCJXYXJlaG91c2VNYW5hZ2VyIl0sImV4cCI6MTc4ODk0NjQ3MCwiaXNzIjoiQXBwQXBpIiwiYXVkIjoiQXBwQXBpIn0.9ysEHvA9NtJi8zObt90gw0uR9J3a9hryC8ldWQCN6d8";

const client = axios.create({
  baseURL: 'https://api.blackskyqore.com/api',
  headers: {
    Authorization: `Bearer ${token}`
  }
});

async function check() {
  try {
    const res = await client.get('/terminal/Inventory/Stocks');
    const items = Array.isArray(res.data) ? res.data : (res.data?.data || res.data?.items || []);
    console.log("Total stocks fetched:", items.length);
    if (items.length > 0) {
      console.log("Keys of first item:", Object.keys(items[0]));
      // find STK-001030 or STK-000657
      const found = items.filter(x => 
        (x.stockCode && (x.stockCode.includes('001030') || x.stockCode.includes('000657'))) ||
        (x.StockCode && (x.StockCode.includes('001030') || x.StockCode.includes('000657')))
      );
      console.log("Found matches:", JSON.stringify(found, null, 2));
      if (found.length === 0) {
        console.log("First item sample:", JSON.stringify(items[0], null, 2));
      }
    }
  } catch (err) {
    console.error("API error:", err.message, err.response?.data);
  }
}

check();
