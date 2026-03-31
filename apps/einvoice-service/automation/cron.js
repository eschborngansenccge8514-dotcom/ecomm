const cron            = require('node-cron');
const { pool }        = require('../db/pool');
const { enqueueInvoiceJob, dlqQueue } = require('./queue');
const db              = require('../db/invoice.db');
const { sendDLQHealthReport } = require('./alerts');

// ─── Helper: get all active merchants ────────────────────────────────────
async function getAllActiveMerchants() {
  const { rows } = await pool.query(
    `SELECT id, merchant_uid, name FROM merchants WHERE status = 'active' ORDER BY id`
  );
  return rows;
}

// ─── 1st of every month at 9:00 AM ───────────────────────────────────────
cron.schedule('0 9 1 * *', async () => {
  const now       = new Date();
  const year      = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month     = now.getMonth() === 0 ? 12 : now.getMonth();
  const label     = `${year}-${String(month).padStart(2, '0')}`;

  console.log(`\n[Cron] 📅 Monthly consolidated run for ${label}`);

  const merchants = await getAllActiveMerchants();
  console.log(`[Cron] Processing ${merchants.length} active merchant(s)...`);

  let submitted = 0, skipped = 0, errored = 0;

  for (const merchant of merchants) {
    try {
      const orders = await db.getStagedConsolidatedOrders(merchant.id, year, month);

      if (orders.length === 0) {
        skipped++;
        continue;
      }

      await enqueueInvoiceJob('consolidated', merchant.merchant_uid, {
        year, month, orders,
      });

      submitted++;
    } catch (err) {
      errored++;
    }
  }

  console.log(`[Cron] Monthly run done — submitted: ${submitted}, skipped: ${skipped}, errored: ${errored}\n`);
});

// ─── Every Monday at 8:00 AM — DLQ health check ──────────────────────────
cron.schedule('0 8 * * 1', async () => {
  console.log('[Cron] 🔍 Weekly DLQ health check...');
  try {
    const dlqJobs = await dlqQueue.getJobs(['wait', 'active', 'delayed']);
    const merchants = await getAllActiveMerchants();
    const merchantMap = new Map(merchants.map(m => [m.merchant_uid, m.name]));

    const countsByMerchant = dlqJobs.reduce((acc, job) => {
      const mid = job.data?.merchantId || 'unknown';
      acc[mid]  = (acc[mid] || 0) + 1;
      return acc;
    }, {});

    const merchantSummaries = Object.entries(countsByMerchant).map(([merchantId, failedCount]) => ({
      merchantId,
      merchantName: merchantMap.get(merchantId) || merchantId,
      failedCount,
    }));

    if (dlqJobs.length > 0) {
      await sendDLQHealthReport({
        totalFailed: dlqJobs.length,
        merchants: merchantSummaries,
      });
    }
  } catch (err) {
    console.error('[Cron] DLQ check failed:', err.message);
  }
});

// ─── Every day at 6:00 AM — check for overdue consolidated submissions ────
cron.schedule('0 6 * * *', async () => {
  const now       = new Date();
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

  const { rows } = await pool.query(`
    SELECT
      m.merchant_uid,
      m.name,
      cs.year,
      cs.month,
      COUNT(*) AS overdue_count
    FROM consolidated_staging cs
    JOIN merchants m ON m.id = cs.merchant_id
    WHERE cs.consolidated_einvoice_id IS NULL
      AND make_date(cs.year, cs.month, 1) < $1
    GROUP BY m.merchant_uid, m.name, cs.year, cs.month
    ORDER BY cs.year, cs.month
  `, [twoMonthsAgo]);

  if (rows.length > 0) {
    const { sendFailureAlert } = require('./alerts');
    for (const row of rows) {
      await sendFailureAlert({
        merchantId:   row.merchant_uid,
        merchantName: row.name,
        jobId:        'overdue-check',
        jobType:      'consolidated',
        orderNumber:  `${row.year}-${String(row.month).padStart(2, '0')}`,
        error:        `${row.overdue_count} staged B2C orders were never submitted to LHDN.`,
        attempts:     0,
      });
    }
  }
});

console.log('[Cron] Schedulers registered.');
