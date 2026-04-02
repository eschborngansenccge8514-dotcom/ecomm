const express           = require('express');
const router            = express.Router();
const einvoice          = require('../services/einvoice.service');
const merchantService   = require('../services/merchant.service');
const { enqueueInvoiceJob, getMerchantQueueStats } = require('../automation/queue');
const { orderEvents }   = require('../automation/events');

async function resolveMerchant(req, res, next) {
  const merchantId = req.headers['x-merchant-id'] || req.params.merchantId;
  if (!merchantId) {
    return res.status(400).json({ success: false, error: 'X-Merchant-Id header is required' });
  }
  try {
    req.merchant   = await merchantService.getMerchant(merchantId);
    req.merchantId = merchantId;
    next();
  } catch (err) {
    res.status(err.message.includes('Not found') ? 404 : 403)
      .json({ success: false, error: err.message });
  }
}

// ── Invoice operations ───────────────────────────────────────────────────

router.post('/invoices/issue', resolveMerchant, async (req, res, next) => {
  try {
    const result = await einvoice.issueInvoice(req.merchantId, req.body);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.post('/invoices/enqueue', resolveMerchant, async (req, res, next) => {
  try {
    const { type = 'invoice', ...payload } = req.body;
    await enqueueInvoiceJob(type, req.merchantId, payload);
    res.json({ success: true, message: 'Job enqueued successfully' });
  } catch (e) { next(e); }
});

router.get('/stats', resolveMerchant, async (req, res, next) => {
  try {
    const stats = await getMerchantQueueStats(req.merchantId);
    res.json({ success: true, data: stats });
  } catch (e) { next(e); }
});

// ── Phase 2 — Staging & Consolidation ───────────────────────────────────

router.post('/receipts', resolveMerchant, async (req, res, next) => {
  try {
    const result = await einvoice.processIncomingOrder(req.merchantId, req.body);
    res.json(result);
  } catch (e) { next(e); }
});

router.post('/receipts/:orderNumber/request-individual', resolveMerchant, async (req, res, next) => {
  try {
    const result = await einvoice.requestIndividualInvoice(req.merchantId, req.params.orderNumber);
    res.json(result);
  } catch (e) { next(e); }
});

router.get('/consolidated/preview/:year/:month', resolveMerchant, async (req, res, next) => {
  try {
    const { year, month } = req.params;
    const db = require('../db/invoice.db'); // Temporary import or move to service
    const orders = await db.getStagedConsolidatedOrders(req.merchantId, parseInt(year), parseInt(month));
    res.json({ success: true, count: orders.length, orders });
  } catch (e) { next(e); }
});

router.post('/consolidated/submit/:year/:month', resolveMerchant, async (req, res, next) => {
  try {
    const { year, month } = req.params;
    const result = await einvoice.issueConsolidatedInvoice(req.merchantId, { 
      year: parseInt(year), 
      month: parseInt(month) 
    });
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.post('/consolidated/sweep', resolveMerchant, async (req, res, next) => {
  try {
    const { runSweep } = require('../scripts/sweep');
    // includeCurrentMonth=true so the manual dashboard trigger picks up all pending orders
    const result = await runSweep(req.merchantId, true);
    res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;
