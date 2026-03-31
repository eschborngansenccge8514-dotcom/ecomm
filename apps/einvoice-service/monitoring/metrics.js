const { pool } = require('../db/pool');

/**
 * Per-merchant invoice metrics for the admin dashboard.
 * All queries are scoped by merchant to enforce data isolation.
 */
async function getMerchantMetrics(merchantId, { year, month } = {}) {
  const now          = new Date();
  const targetYear   = year  || now.getFullYear();
  const targetMonth  = month || now.getMonth() + 1;

  const [byStatus, byType, monthly, recentFailed, successRate] = await Promise.all([

    // Count by status (all time)
    pool.query(`
      SELECT status, COUNT(*) AS count
      FROM einvoices WHERE merchant_id = $1
      GROUP BY status ORDER BY count DESC
    `, [merchantId]),

    // Count by type (this month)
    pool.query(`
      SELECT invoice_type, COUNT(*) AS count
      FROM einvoices
      WHERE merchant_id = $1
        AND EXTRACT(YEAR  FROM created_at) = $2
        AND EXTRACT(MONTH FROM created_at) = $3
      GROUP BY invoice_type
    `, [merchantId, targetYear, targetMonth]),

    // Monthly volume (last 6 months)
    pool.query(`
      SELECT
        EXTRACT(YEAR  FROM created_at)::int AS year,
        EXTRACT(MONTH FROM created_at)::int AS month,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'valid')     AS valid,
        COUNT(*) FILTER (WHERE status = 'invalid')   AS invalid,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
      FROM einvoices
      WHERE merchant_id = $1
        AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY year, month
      ORDER BY year, month
    `, [merchantId]),

    // Recent failed jobs
    pool.query(`
      SELECT job_type, order_number, error, failed_at
      FROM failed_invoice_jobs
      WHERE merchant_id = $1 AND resolved = FALSE
      ORDER BY failed_at DESC LIMIT 5
    `, [merchantId]),

    // 30-day success rate
    pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'valid') AS valid
      FROM einvoices
      WHERE merchant_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'
    `, [merchantId]),

  ]);

  const total30d      = parseInt(successRate.rows[0]?.total  || 0);
  const valid30d      = parseInt(successRate.rows[0]?.valid  || 0);
  const successRate30 = total30d > 0
    ? ((valid30d / total30d) * 100).toFixed(1)
    : null;

  return {
    period:        { year: targetYear, month: targetMonth },
    byStatus:      Object.fromEntries(byStatus.rows.map(r => [r.status, parseInt(r.count)])),
    byType:        Object.fromEntries(byType.rows.map(r => [r.invoice_type, parseInt(r.count)])),
    monthlyVolume: monthly.rows.map(r => ({
      year:      r.year,
      month:     r.month,
      total:     parseInt(r.total),
      valid:     parseInt(r.valid),
      invalid:   parseInt(r.invalid),
      cancelled: parseInt(r.cancelled),
    })),
    recentFailed:  recentFailed.rows,
    successRate30d: successRate30 ? `${successRate30}%` : 'N/A',
  };
}

/**
 * Platform-wide metrics for super-admin
 */
async function getPlatformMetrics() {
  const { rows } = await pool.query(`
    SELECT
      COUNT(DISTINCT merchant_id)                        AS active_merchants,
      COUNT(*)                                           AS total_invoices,
      COUNT(*) FILTER (WHERE status = 'valid')           AS valid_invoices,
      COUNT(*) FILTER (WHERE status = 'invalid')         AS invalid_invoices,
      COUNT(*) FILTER (WHERE status = 'pending'
        AND created_at < NOW() - INTERVAL '15 minutes')  AS stuck_invoices,
      COUNT(*) FILTER (
        WHERE EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
          AND EXTRACT(YEAR  FROM created_at) = EXTRACT(YEAR  FROM NOW())
      ) AS invoices_this_month
    FROM einvoices
  `);

  return rows[0];
}

module.exports = { getMerchantMetrics, getPlatformMetrics };
