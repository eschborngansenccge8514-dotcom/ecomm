const EventEmitter          = require('events');
const { enqueueInvoiceJob } = require('./queue');
const db                    = require('../db/invoice.db');
const merchantService       = require('../services/merchant.service');
const einvoice              = require('../services/einvoice.service');

// Global emitter — all merchants share it; merchantId is always in the payload
const orderEvents = new EventEmitter();
orderEvents.setMaxListeners(50);

// ─── ORDER PAID ───────────────────────────────────────────────────────────
orderEvents.on('order.paid', async (payload) => {
  const { merchantId, orderNumber, buyer, items, discount } = payload;

  try {
    if (buyer?.tin) {
      await enqueueInvoiceJob('invoice', merchantId, {
        orderNumber, buyer, items, discount,
      });
      console.log(`[Events] Enqueued invoice for order ${orderNumber} (merchant: ${merchantId})`);
    } else {
      const merchant = await merchantService.getMerchant(merchantId);
      const now      = new Date();
      await db.stageForConsolidated({
        merchantId: merchant.id,
        orderNumber,
        subtotal: items.reduce((s, i) => s + (i.subtotal ?? i.quantity * i.unitPrice), 0),
        tax:      items.reduce((s, i) => s + (i.tax ?? 0), 0),
        year:     now.getFullYear(),
        month:    now.getMonth() + 1,
      });
      console.log(`[Events] Order ${orderNumber} staged for consolidated (merchant: ${merchantId})`);
    }
  } catch (err) {
    console.error(`[Events] order.paid handler failed — merchant: ${merchantId}: ${err.message}`);
  }
});

// ─── ORDER CANCELLED (within 72h) ─────────────────────────────────────────
orderEvents.on('order.cancelled', async ({ merchantId, uuid, orderNumber, reason }) => {
  try {
    await einvoice.cancelInvoice(
      merchantId, uuid,
      reason || 'Order cancelled by customer',
      orderNumber
    );
    console.log(`[Events] Invoice cancelled — merchant: ${merchantId}, order: ${orderNumber}`);
  } catch (err) {
    console.error(`[Events] cancel failed — merchant: ${merchantId}: ${err.message}`);
  }
});

// ─── ORDER REFUNDED ───────────────────────────────────────────────────────
orderEvents.on('order.refunded', async (payload) => {
  const { merchantId, ...data } = payload;
  try {
    await enqueueInvoiceJob('refund-note', merchantId, data);
    console.log(`[Events] Refund note queued — merchant: ${merchantId}, ref: ${data.refNumber}`);
  } catch (err) {
    console.error(`[Events] order.refunded failed — merchant: ${merchantId}: ${err.message}`);
  }
});

// ─── PRICE CORRECTION ─────────────────────────────────────────────────────
orderEvents.on('invoice.credit', async (payload) => {
  const { merchantId, ...data } = payload;
  try {
    await enqueueInvoiceJob('credit-note', merchantId, data);
    console.log(`[Events] Credit note queued — merchant: ${merchantId}`);
  } catch (err) {
    console.error(`[Events] invoice.credit failed — merchant: ${merchantId}: ${err.message}`);
  }
});

orderEvents.on('invoice.debit', async (payload) => {
  const { merchantId, ...data } = payload;
  try {
    await enqueueInvoiceJob('debit-note', merchantId, data);
    console.log(`[Events] Debit note queued — merchant: ${merchantId}`);
  } catch (err) {
    console.error(`[Events] invoice.debit failed — merchant: ${merchantId}: ${err.message}`);
  }
});

// ─── MERCHANT SETTINGS UPDATED ────────────────────────────────────────────
orderEvents.on('merchant.updated', ({ merchantId }) => {
  merchantService.invalidateMerchantCache(merchantId);
  const { invalidateCertCache } = require('../services/signer');
  merchantService.getMerchant(merchantId)
    .then(m => invalidateCertCache(m.id))
    .catch(() => {});
  console.log(`[Events] Caches cleared for updated merchant: ${merchantId}`);
});

module.exports = { orderEvents };
