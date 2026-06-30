const axios = require('axios');

async function testBarcode(payload, contentType) {
    try {
        console.log(`\nTesting with Content-Type: ${contentType} and payload:`, payload);
        const res = await axios.post('https://api.blackskyqore.com/api/Inventory/stock/qrcode', payload, {
            headers: { 'Content-Type': contentType }
        });
        console.log('Success! Status:', res.status, 'Data:', res.data);
    } catch (e) {
        console.log('Error:', e.response ? e.response.status : e.message);
        if (e.response && e.response.data) {
            console.log('Error Data:', e.response.data);
        }
    }
}

async function run() {
    // 1. JSON String (current implementation)
    await testBarcode(JSON.stringify("132456789546"), 'application/json');
    
    // 2. Direct string
    await testBarcode("132456789546", 'application/json');

    // 3. Object with qrcode key
    await testBarcode({ qrcode: "132456789546" }, 'application/json');
    
    // 4. Object with barcode key
    await testBarcode({ barcode: "132456789546" }, 'application/json');

    // 5. Plain text
    await testBarcode("132456789546", 'text/plain');
}

run();
