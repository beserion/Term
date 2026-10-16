const sql = require('mssql');

const config = {
  user: 'sa',
  password: 'Password1!',
  server: '149.34.201.53',
  database: 'GEMINI',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    connectTimeout: 5000,
  }
};

async function run() {
  const pool = await sql.connect(config);
  console.log('Connected to SQL');

  const r = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'INV_Stocks'");
  console.log('Columns:');
  console.log(r.recordset.map(x => x.COLUMN_NAME + ' (' + x.DATA_TYPE + ')').join('\n'));

  const sample = await pool.request().query("SELECT TOP 5 Id, StockCode, StockName, Photo, ImageUrl, Picture, ImagePath FROM INV_Stocks WHERE Photo IS NOT NULL OR ImageUrl IS NOT NULL OR Picture IS NOT NULL");
  console.log('Sample photo rows:');
  console.table(sample.recordset);

  pool.close();
}

run().catch(console.error);
