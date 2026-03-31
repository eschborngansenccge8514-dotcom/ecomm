const express         = require('express');
const router          = express.Router();
const db              = require('../db/invoice.db');
const merchantService = require('../services/merchant.service');
const { runHealthCheck }     = require('../monitoring/healthcheck');
const { getMerchantMetrics, getPlatformMetrics } = require('../monitoring/metrics');
const { dlqQueue, einvoiceQueue, enqueueInvoiceJob } = require('../automation/queue');
const { pool }        = require('../db/pool');

// ── Platform health ───────────────────────────────────────────────────────

router.get('/health', async (req, res, next) => {
  try {
    const result = await runHealthCheck();
    res.status(result.status === 'ok' ? 200 : 503).json(result);
  } catch (e) { next(e); }
});

// ── Platform-wide stats (super-admin) ────────────────────────────────────

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getPlatformMetrics();
    res.json({ success: true, data: stats });
  } catch (e) { next(e); }
});

// ── Merchant management ───────────────────────────────────────────────────

router.get('/merchants', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, merchant_uid, name, status, env, tin, email, created_at
      FROM merchants ORDER BY created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

router.get('/merchants/:merchantId', async (req, res, next) => {
  try {
    const merchant = await merchantService.getMerchant(req.params.merchantId);
    const { lhdn_client_secret, cert_p12_base64, cert_passphrase, ...safe } = merchant;
    res.json({ success: true, data: safe });
  } catch (e) { next(e); }
});

// ── Per-merchant metrics ──────────────────────────────────────────────────

router.get('/merchants/:merchantId/metrics', async (req, res, next) => {
  try {
    const merchant = await merchantService.getMerchant(req.params.merchantId);
    const { year, month } = req.query;
    const metrics = await getMerchantMetrics(merchant.id, {
      year:  year  ? parseInt(year)  : undefined,
      month: month ? parseInt(month) : undefined,
    });
    res.json({ success: true, data: metrics });
  } catch (e) { next(e); }
});

// ── Dead Letter Queue (DLQ) ───────────────────────────────────────────────

router.get('/dlq', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT f.*, m.merchant_uid, m.name AS merchant_name
      FROM failed_invoice_jobs f
      LEFT JOIN merchants m ON m.id = f.merchant_id
      WHERE f.resolved = FALSE
      ORDER BY f.failed_at DESC
      LIMIT 100
    `);
    res.json({ success: true, data: rows, count: rows.length });
  } catch (e) { next(e); }
});

// Retry a failed job — re-enqueue with original payload
router.post('/merchants/:merchantId/dlq/:jobId/retry', async (req, res, next) => {
  try {
    const merchant = await merchantService.getMerchant(req.params.merchantId);
    const { rows } = await pool.query(
      `SELECT * FROM failed_invoice_jobs WHERE id = $1 AND merchant_id = $2`,
      [req.params.jobId, merchant.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Failed job not found' });
    }

    const job = rows[0];
    await enqueueInvoiceJob(job.job_type, req.params.merchantId, job.payload);
    
    await pool.query(
      `UPDATE failed_invoice_jobs SET resolved = TRUE, resolved_at = NOW(), resolved_by = $1 WHERE id = $2`,
      [req.body.resolvedBy || 'admin-retry', job.id]
    );

    res.json({ success: true, message: 'Job re-queued successfully' });
  } catch (e) { next(e); }
});

module.exports = router;
