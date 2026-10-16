const axios = require('axios');
const fs = require('fs');

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2N2NlNzJlOC1kZWVjLTQzMTUtOGQ3Zi1jZDgyZDE2ZWIxOTIiLCJlbWFpbCI6ImRlcG9AZ2VtaW5pbWFyLmNvbSIsImh0dHA6Ly9zY2hlbWFzLnhtbHNvYXAub3JnL3dzLzIwMDUvMDUvaWRlbnRpdHkvY2xhaW1zL25hbWVpZGVudGlmaWVyIjoiNjdjZTcyZTgtZGVlYy00MzE1LThkN2YtY2Q4MmQxNmViMTkyIiwiY29tcGFueUlkIjoiMSIsImJyYW5jaElkIjoiMCIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6WyJBZG1pbiIsIlN1cGVyQWRtaW4iLCJXYXJlaG91c2VNYW5hZ2VyIl0sImV4cCI6MTc4ODUwODc1MCwiaXNzIjoiQXBwQXBpIiwiYXVkIjoiQXBwQXBpIn0.v5zpbVd8qu_NCcCT5io3ogGnEfgovbbG9zWp-Pe4mtI";

const apiBase = 'https://api.blackskyqore.com/api';

async function main() {
  console.log('Fetching stocks...');
  try {
    const res = await axios.get(`${apiBase}/Inventory/stocks`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('GET Inventory/stocks status:', res.status);
    const data = res.data;
    let list = Array.isArray(data) ? data : (data.data || data.items || []);
    console.log('Total stocks count:', list.length);

    // Check unique brands
    const brands = new Set();
    list.forEach(item => {
      if (item.brand) brands.add(item.brand);
      if (item.Brand) brands.add(item.Brand);
    });
    console.log('Unique brands found in list (' + brands.size + '):', Array.from(brands).slice(0, 30));

    // Search for "kiwi" case-insensitively anywhere in the item
    const kiwiItems = list.filter(item => {
      const str = JSON.stringify(item).toLowerCase();
      return str.includes('kiwi');
    });

    console.log('\n--- Searching for "kiwi" across ALL items ---');
    console.log('Found:', kiwiItems.length);
    kiwiItems.forEach((item, i) => {
      console.log(`\nMatch #${i + 1}:`);
      console.log(JSON.stringify(item, null, 2));
    });

    if (kiwiItems.length === 0) {
      console.log('\nNo items with "kiwi" in Inventory/stocks. Checking /terminal/Inventory/Stocks ...');
      const res2 = await axios.get(`${apiBase}/terminal/Inventory/Stocks`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      let list2 = Array.isArray(res2.data) ? res2.data : (res2.data.data || res2.data.items || []);
      console.log('Total in /terminal/Inventory/Stocks:', list2.length);
      const kiwi2 = list2.filter(item => JSON.stringify(item).toLowerCase().includes('kiwi'));
      console.log('Found in /terminal/Inventory/Stocks:', kiwi2.length);
      kiwi2.forEach((item, i) => {
        console.log(`\nTerminal Match #${i + 1}:`);
        console.log(JSON.stringify(item, null, 2));
      });
    }

  } catch (err) {
    console.error('Error:', err.response ? `${err.response.status} ${JSON.stringify(err.response.data)}` : err.message);
  }
}

main();
