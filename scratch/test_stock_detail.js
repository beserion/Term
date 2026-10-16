const axios = require('axios');

async function test() {
  try {
    const loginRes = await axios.post('https://api.blackskyqore.com/api/Auth/login', {
      userName: 'Admin',
      password: 'BlueHub1!'
    });
    const token = loginRes.data?.data?.token || loginRes.data?.token;
    console.log('Login OK, token prefix:', token ? token.substring(0, 15) : 'no token');

    const headers = { Authorization: `Bearer ${token}` };
    const stockRes = await axios.get('https://api.blackskyqore.com/api/terminal/Inventory/Stocks/ByCode/STK-000127', { headers });
    console.log('Stock STK-000127:', JSON.stringify(stockRes.data, null, 2));
  } catch (e) {
    console.error('Error:', e.response ? { status: e.response.status, data: e.response.data } : e.message);
  }
}

test();
