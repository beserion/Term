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
    console.log("=== 1. /terminal/Orders/List ===");
    const res1 = await client.get('/terminal/Orders/List');
    console.log("Orders count:", res1.data?.data?.length);
    console.log("Orders all:", JSON.stringify(res1.data?.data, null, 2));

    console.log("\n=== 2. /terminal/Orders/Details?id=11 ===");
    try {
      const res2 = await client.get('/terminal/Orders/Details?id=11');
      console.log("Details res2:", JSON.stringify(res2.data, null, 2));
    } catch (e) {
      console.log("res2 error:", e.response?.status, e.response?.data || e.message);
    }

    console.log("\n=== 3. /terminal/Packing/ActiveOrders ===");
    try {
      const res3 = await client.get('/terminal/Packing/ActiveOrders');
      console.log("ActiveOrders count:", res3.data?.data?.length);
      console.log("ActiveOrders sample:", JSON.stringify(res3.data?.data?.slice(0, 3), null, 2));
    } catch (e) {
      console.log("res3 error:", e.response?.status, e.response?.data || e.message);
    }

  } catch (err) {
    console.error("General error:", err.message);
  }
}

check();
