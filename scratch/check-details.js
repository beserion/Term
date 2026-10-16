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
    const id = 14;
    console.log("Checking order id:", id);

    const supRes = await client.get(`/terminal/Orders/${id}/Suppliers`);
    console.log("Suppliers:", JSON.stringify(supRes.data, null, 2));

    const supId = supRes.data[0]?.supplierId || supRes.data[0]?.id;
    console.log("Using supplier id:", supId);

    const detailRes = await client.get(`/terminal/Orders/${id}/Supplier/${supId}/Details`);
    console.log("Supplier order details item 0:", JSON.stringify(detailRes.data[0], null, 2));

  } catch (err) {
    console.error("API error:", err.message, err.response?.data);
  }
}

check();
