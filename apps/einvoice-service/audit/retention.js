const cron = require('node-cron');
const { pool } = require('../db/pool');

const RETENTION_YEARS = 7;

/**
 * Monthly job that checks for records nearing or past the 7-year retention window.
 * Run on the 1st of every month at 3AM.
 */
cron.schedule('0 3 1 * *', async () => {
  console.log('[Retention] Running 7-year retention audit...');

  // 1. Purge old audit logs (save space)
  const { rowCount } = await pool.query(`
    DELETE FROM einvoice_audit_log
    WHERE created_at < NOW() - INTERVAL '${RETENTION_YEARS} years 1 month'
  `);

  if (rowCount > 0) {
    console.log(`[Retention] Purged ${rowCount} audit log entries older than 7 years.`);
  }

  // 2. Alert on upcoming retention (we don't delete invoices, but we flag them)
  const { rows: stats } = await pool.query(`
    SELECT COUNT(*) as total, MIN(submitted_at) as oldest
    FROM einvoices
    WHERE submitted_at < NOW() - INTERVAL '${RETENTION_YEARS} years'
  `);

  if (stats[0].total > 0) {
    console.warn(`[Retention] ⚠️ ${stats[0].total} invoices are now older than ${RETENTION_YEARS} years (Oldest: ${stats[0].oldest}).`);
  }
});

console.log('[Retention] cron registered (7-year rule).');
