require('dotenv').config();
const { pool } = require('./db/pool');

async function test() {
  console.log('Testing DB connection via pool.js...');
  console.log('Schema:', process.env.DB_SCHEMA || 'einvoicing');
  
  try {
    const client = await pool.connect();
    console.log('✅ Connected to DB');
    
    // Check search path
    const pathRes = await client.query('SHOW search_path');
    console.log('Search Path:', pathRes.rows[0].search_path);
    
    const res = await client.query('SELECT current_schema()');
    console.log('Current Schema:', res.rows[0].current_schema);
    
    client.release();
  } catch (err) {
    console.error('❌ DB Connection Failed:', err.stack);
  } finally {
    await pool.end();
  }
}

test();
