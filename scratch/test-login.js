const axios = require('axios');

async function run() {
  try {
    console.log('Sending login request...');
    const startTime = Date.now();
    const res = await axios.post('https://api.blackskyqore.com/api/Auth/login', {
      userName: 'demo',
      password: 'password123'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    console.log(`Success! Status: ${res.status}, Time: ${Date.now() - startTime}ms`);
    console.log('Data:', res.data);
  } catch (e) {
    console.log(`Error after ${Date.now() - Date.now()}ms:`, e.response ? e.response.status : e.message);
    if (e.response && e.response.data) {
      console.log('Error Data:', e.response.data);
    }
  }
}

run();
