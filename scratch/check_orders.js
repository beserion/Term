const sql = require('mssql');

const config = {
  user: 'sa',
  password: 'Password1!',
  server: '149.34.201.53',
  database: 'GEMINI',
  options: { encrypt: false, trustServerCertificate: true, connectTimeout: 10000 }
};

async function test() {
  const pool = await sql.connect(config);
  
  // Check tables
  const tables = await pool.request().query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%Order%' OR TABLE_NAME LIKE '%Pack%' OR TABLE_NAME LIKE '%WMS%'"
  );
  console.log('Tables:', tables.recordset.map(t => t.TABLE_NAME));

  // Check REQ_Orders
  const orders = await pool.request().query("SELECT TOP 20 * FROM REQ_Orders ORDER BY Id DESC");
  console.log('Recent REQ_Orders count:', orders.recordset.length);
  if (orders.recordset.length > 0) {
    console.log('Sample Order columns:', Object.keys(orders.recordset[0]));
    console.log('Recent REQ_Orders:', orders.recordset.map(o => ({
      Id: o.Id,
      OrderNo: o.OrderNo,
      RfqNo: o.RfqNo,
      Status: o.Status,
      PartnerName: o.PartnerName || o.SupplierName,
      IsCompleted: o.IsCompleted,
      IsPackingCompleted: o.IsPackingCompleted
    })));
  }

  // Check WMS_Boxes / Packing tables if any
  try {
    const boxes = await pool.request().query("SELECT TOP 20 * FROM WMS_Boxes ORDER BY Id DESC");
    console.log('WMS_Boxes count:', boxes.recordset.length);
  } catch (e) {
    console.log('WMS_Boxes query error:', e.message);
  }

  pool.close();
}

test().catch(console.error);
