const sql = require('mssql');

const config = {
  user: 'sa',
  password: 'Password1!',
  server: '149.34.201.53',
  database: 'GEMINI',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 10000,
  }
};

async function run() {
  const pool = await sql.connect(config);
  console.log('Connected to SQL');

  const s = await pool.request().query("SELECT Id, StockCode, StockName, ShelfAddress, Barcode, WarehouseId FROM INV_Stocks WHERE StockCode IN ('000101', '000103', '000114', '000120', 'STK-001030', 'STK-000657', 'STK-000280', 'STK-000181')");
  console.log('Stocks in INV_Stocks:');
  console.table(s.recordset);

  // Check ORD_OrderDetails or similar to see if shelf address is on order detail
  const odCols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME LIKE '%OrderDetail%' OR TABLE_NAME LIKE '%OrderLines%'");
  console.log('Order detail columns:', odCols.recordset.map(c => c.COLUMN_NAME));

  pool.close();
}

run().catch(console.error);
