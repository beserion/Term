const axios = require('../node_modules/axios');
const fs = require('fs');

async function getSwagger() {
  const urls = [
    'https://api.blackskyqore.com/swagger/v1/swagger.json',
    'https://api.blackskyqore.com/api/swagger/v1/swagger.json',
    'https://api.blackskyqore.com/swagger/index.html',
    'https://api.blackskyqore.com/api-docs'
  ];

  for (const url of urls) {
    try {
      console.log('Trying:', url);
      const res = await axios.get(url, { timeout: 8000 });
      console.log('Success:', url, 'Type:', typeof res.data);
      if (typeof res.data === 'object') {
        const paths = Object.keys(res.data.paths || {});
        console.log('Total paths found:', paths.length);
        const orderAndStockPaths = paths.filter(p => p.toLowerCase().includes('order') || p.toLowerCase().includes('stock') || p.toLowerCase().includes('pack') || p.toLowerCase().includes('rfq') || p.toLowerCase().includes('terminal'));
        console.log('Relevant paths:', orderAndStockPaths);
        fs.writeFileSync('./scratch/swagger-summary.json', JSON.stringify(orderAndStockPaths, null, 2));
        return;
      }
    } catch (e) {
      console.log('Failed:', url, e.message);
    }
  }
}

getSwagger();
