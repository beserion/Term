const axios = require('../node_modules/axios');

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2N2NlNzJlOC1kZWVjLTQzMTUtOGQ3Zi1jZDgyZDE2ZWIxOTIiLCJlbWFpbCI6ImRlcG9AZ2VtaW5pbWFyLmNvbSIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWVpZGVudGlmaWVyIjoiNjdjZTcyZTgtZGVlYy00MzE1LThkN2YtY2Q4MmQxNmViMTkyIiwiY29tcGFueUlkIjoiMSIsImJyYW5jaElkIjoiMCIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6WyJBZG1pbiIsIlN1cGVyQWRtaW4iLCJXYXJlaG91c2VNYW5hZ2VyIl0sImV4cCI6MTc4ODk0NjQ3MCwiaXNzIjoiQXBwQXBpIiwiYXVkIjoiQXBwQXBpIn0.9ysEHvA9NtJi8zObt90gw0uR9J3a9hryC8ldWQCN6d8";

const client = axios.create({
  baseURL: 'https://api.blackskyqore.com/api',
  headers: {
    Authorization: `Bearer ${token}`
  }
});

const endpoints = [
  '/terminal/Orderlist',
  '/terminal/Orderlist?startRow=0&endRow=100',
  '/terminal/Orders/11',
  '/terminal/Orders/11/Details',
  '/terminal/Orders/11/Suppliers',
  '/terminal/Orders/11/Supplier/480/Details',
  '/terminal/Orders/11/Info',
  '/Orders/11',
  '/Order/11',
  '/Inquiry/11',
  '/terminal/Inquiry/List'
];

async function check() {
  for (const ep of endpoints) {
    try {
      const res = await client.get(ep);
      console.log(`[SUCCESS] ${ep}:`, typeof res.data, Array.isArray(res.data) ? `Array(${res.data.length})` : Object.keys(res.data || {}));
      console.log(`SAMPLE for ${ep}:`, JSON.stringify(res.data).substring(0, 300));
    } catch (e) {
      console.log(`[FAIL] ${ep}:`, e.response?.status);
    }
  }
}

check();
