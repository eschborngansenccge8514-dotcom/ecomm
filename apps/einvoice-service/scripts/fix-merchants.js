const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.dgafjyrittkskxlgswvf:iSU3aOFvpUlnZnRG@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
});
async function run() {
  try {
    const { rows } = await pool.query('SELECT id, store_name FROM public.merchants LIMIT 1;');
    if (rows.length === 0) return console.log('No merchants found');
    const merchantId = rows[0].id;
    const storeName = rows[0].store_name;
    
    await pool.query('UPDATE einvoicing.merchants SET merchant_uid = $1, name = $2 WHERE merchant_uid = $3', 
      [merchantId, storeName, 'test-merchant-alpha']);
    console.log('✅ Updated einvoicing.merchants record to use UUID:', merchantId);
  } catch(e) {
    console.error('❌ SQL Error:', e);
  } finally {
    await pool.end();
  }
}
run();
