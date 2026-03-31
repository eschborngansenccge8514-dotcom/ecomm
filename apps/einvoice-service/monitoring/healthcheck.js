const { pool, ping: dbPing } = require('../db/pool');
const { getToken }           = require('../services/auth');
const merchantService        = require('../services/merchant.service');

/**
 * Deep health check — verifies all system components.
 * Called by GET /health
 */
async function runHealthCheck() {
  const checks  = {};
  const details = {};

  // ── Database ───────────────────────────────────────────────────────────
  try {
    await dbPing();
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS total FROM einvoices WHERE status = 'pending'
       AND created_at < NOW() - INTERVAL '15 minutes'`
    );
    checks.database  = true;
    details.database = {
      status:          'connected',
      stuck_invoices:  parseInt(rows[0].total), // invoices stuck in pending > 15min
    };
  } catch (err) {
    checks.database  = false;
    details.database = { error: err.message };
  }

  // ── Redis ──────────────────────────────────────────────────────────────
  try {
    const { connection } = require('../automation/queue');
    await connection.ping();
    const { einvoiceQueue, dlqQueue } = require('../automation/queue');
    const queueCounts = await einvoiceQueue.getJobCounts('waiting', 'active', 'failed');
    const dlqCount    = await dlqQueue.getJobCounts('waiting');
    checks.redis  = true;
    details.redis = {
      status:        'connected',
      queue_waiting: queueCounts.waiting || 0,
      queue_active:  queueCounts.active  || 0,
      queue_failed:  queueCounts.failed  || 0,
      dlq_waiting:   dlqCount.waiting    || 0,
    };
  } catch (err) {
    checks.redis  = false;
    details.redis = { error: err.message };
  }

  // ── LHDN Connectivity (spot-check first active merchant) ──────────────
  try {
    const { rows } = await pool.query(
      `SELECT * FROM merchants WHERE status = 'active' LIMIT 1`
    );
    if (rows.length > 0) {
      const token = await getToken(rows[0]);
      checks.lhdn_auth  = !!token;
      details.lhdn_auth = {
        status: 'reachable',
        env:    rows[0].env,
        tested_merchant: rows[0].merchant_uid,
      };
    } else {
      checks.lhdn_auth  = true; // no merchants yet — not a failure
      details.lhdn_auth = { status: 'no_active_merchants' };
    }
  } catch (err) {
    checks.lhdn_auth  = false;
    details.lhdn_auth = { error: err.message };
  }

  // ── Merchant count ─────────────────────────────────────────────────────
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')      AS active,
        COUNT(*) FILTER (WHERE status = 'suspended')   AS suspended,
        COUNT(*) FILTER (WHERE env = 'production')     AS production,
        COUNT(*) FILTER (WHERE env = 'sandbox')        AS sandbox
      FROM merchants
    `);
    checks.merchants  = true;
    details.merchants = {
      active:     parseInt(rows[0].active),
      suspended:  parseInt(rows[0].suspended),
      production: parseInt(rows[0].production),
      sandbox:    parseInt(rows[0].sandbox),
    };
  } catch (err) {
    checks.merchants  = false;
    details.merchants = { error: err.message };
  }

  const healthy = Object.values(checks).every(Boolean);

  return {
    status:    healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
    details,
  };
}

module.exports = { runHealthCheck };
