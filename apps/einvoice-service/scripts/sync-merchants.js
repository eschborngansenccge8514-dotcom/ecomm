require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:iSU3aOFvpUlnZnRG@db.dgafjyrittkskxlgswvf.supabase.co:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    // Get all public merchants
    const { rows: merchants } = await pool.query('SELECT id, store_name FROM public.merchants ORDER BY created_at');
    console.log('Public merchants:', merchants.map(m => `${m.id} (${m.store_name})`));

    // Get existing einvoicing merchants
    const { rows: existing } = await pool.query('SELECT merchant_uid FROM einvoicing.merchants');
    const existingUids = existing.map(r => r.merchant_uid);
    console.log('Existing einvoicing UIDs:', existingUids);

    // Get template config from first merchant (copies LHDN creds for sandbox testing)
    const { rows: templateRows } = await pool.query('SELECT * FROM einvoicing.merchants ORDER BY id LIMIT 1');
    if (templateRows.length === 0) return console.log('No template merchant found');
    const t = templateRows[0];

    for (const m of merchants) {
      if (existingUids.includes(m.id)) {
        console.log('Already exists:', m.id, m.store_name);
        continue;
      }
      await pool.query(`
        INSERT INTO einvoicing.merchants 
          (merchant_uid, name, status, env, tin, brn, msic, phone, email,
           address, postcode, city, state, country,
           lhdn_client_id, lhdn_client_secret,
           cert_p12_base64, cert_passphrase, cert_issuer_name, cert_serial_number)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        ON CONFLICT DO NOTHING
      `, [
        m.id, m.store_name, t.status, t.env, t.tin, t.brn, t.msic,
        t.phone, t.email, t.address, t.postcode, t.city, t.state, t.country,
        t.lhdn_client_id, t.lhdn_client_secret,
        t.cert_p12_base64, t.cert_passphrase, t.cert_issuer_name, t.cert_serial_number
      ]);
      console.log('Added to einvoicing.merchants:', m.id, m.store_name);
    }
    console.log('Done!');
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

run();
