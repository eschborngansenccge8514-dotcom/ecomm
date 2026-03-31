// __tests__/phase1.verify.js
// Run with: node __tests__/phase1.verify.js

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { getToken }  = require('../services/auth');
const { ping }      = require('../db/pool');
const config        = require('../config');

const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, status: '✅ PASS' });
  } catch (err) {
    results.push({ name, status: `❌ FAIL — ${err.message}` });
  }
}

async function run() {
  console.log('\n🔍 Phase 1 Verification\n' + '─'.repeat(50));

  await check('Environment is sandbox', async () => {
    if (config.ENV === 'production') throw new Error('Should be sandbox for Phase 1');
  });

  await check('All required env vars present', async () => {
    config.validateConfig();
  });

  await check('Database connection', async () => {
    await ping();
  });

  await check('einvoices table exists', async () => {
    const { pool } = require('../db/pool');
    const { rows } = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'einvoices'
    `);
    if (rows.length === 0) throw new Error('Table "einvoices" not found — run: npm run migrate');
  });

  await check('consolidated_staging table exists', async () => {
    const { pool } = require('../db/pool');
    const { rows } = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'consolidated_staging'
    `);
    if (rows.length === 0) throw new Error('Table "consolidated_staging" not found');
  });

  await check('einvoice_audit_log table exists', async () => {
    const { pool } = require('../db/pool');
    const { rows } = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'einvoice_audit_log'
    `);
    if (rows.length === 0) throw new Error('Table "einvoice_audit_log" not found');
  });

  await check('failed_invoice_jobs table exists', async () => {
    const { pool } = require('../db/pool');
    const { rows } = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'failed_invoice_jobs'
    `);
    if (rows.length === 0) throw new Error('Table "failed_invoice_jobs" not found');
  });

  await check('LHDN sandbox token fetch', async () => {
    const token = await getToken();
    if (!token || token.length < 10) throw new Error('Token returned is empty or invalid');
    console.log(`   Token preview: ${token.slice(0, 30)}...`);
  });

  await check('Token caching works (second call uses cache)', async () => {
    const t1 = await getToken();
    const t2 = await getToken();
    if (t1 !== t2) throw new Error('Token was not cached — two different tokens returned');
  });

  await check('DB audit log write works', async () => {
    const db = require('../db/invoice.db');
    await db.auditLog({
      orderNumber:  'PHASE1-VERIFY',
      action:       'phase1-check',
      endpoint:     '/verify',
      requestBody:  { test: true },
      responseBody: { ok: true },
      statusCode:   200,
      durationMs:   1,
    });
  });

  // ── Print results ──────────────────────────────────────────────────────
  console.log('\n📋 Results\n' + '─'.repeat(50));
  results.forEach(r => console.log(`${r.status}  ${r.name}`));

  const passed = results.filter(r => r.status.startsWith('✅')).length;
  const failed = results.filter(r => r.status.startsWith('❌')).length;

  console.log('\n' + '─'.repeat(50));
  console.log(`Total: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('\n✅ Phase 1 Verification Successful! You are ready for Phase 2.\n');
  } else {
    console.log('\n❌ Phase 1 Verification Failed. Please fix the errors above.\n');
    process.exit(1);
  }
}

run();
