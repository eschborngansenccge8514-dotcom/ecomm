const { Worker }          = require('bullmq');
const { connection, dlqQueue } = require('./queue');
const einvoice            = require('../services/einvoice.service');
const merchantService     = require('../services/merchant.service');
const { sendInvoiceEmail }   = require('./mailer');
const { sendFailureAlert }   = require('./alerts');
const db                  = require('../db/invoice.db');

const worker = new Worker('einvoice', async (job) => {
  const { merchantId, ...data } = job.data;
  const jobType = job.name;

  console.log(`[Worker] Job id=${job.id} type="${jobType}" merchant="${merchantId}"`);

  // Load merchant — throws if not found or suspended
  const merchant = await merchantService.getMerchant(merchantId);
  let result;

  // ── Route to correct service method ──────────────────────────────────
  switch (jobType) {
    case 'invoice':
      result = await einvoice.issueInvoice(merchantId, {
        orderNumber: data.orderNumber,
        buyer:       data.buyer,
        items:       data.items,
        discount:    data.discount || 0,
      });
      break;

    case 'credit-note':
      result = await einvoice.issueCreditNote(merchantId, {
        refNumber:         data.refNumber,
        originalInvoiceId: data.originalInvoiceId,
        buyer:             data.buyer,
        items:             data.items,
      });
      break;

    case 'debit-note':
      result = await einvoice.issueDebitNote(merchantId, {
        refNumber:         data.refNumber,
        originalInvoiceId: data.originalInvoiceId,
        buyer:             data.buyer,
        items:             data.items,
      });
      break;

    case 'refund-note':
      result = await einvoice.issueRefundNote(merchantId, {
        refNumber:         data.refNumber,
        originalInvoiceId: data.originalInvoiceId,
        buyer:             data.buyer,
        items:             data.items,
      });
      break;

    case 'consolidated':
      result = await einvoice.issueConsolidatedInvoice(merchantId, {
        year:   data.year,
        month:  data.month,
        orders: data.orders,
      });
      break;

    default:
      throw new Error(`[Worker] Unknown job type: ${jobType}`);
  }

  // ── Email customer (skip for consolidated — no individual buyer) ──────
  if (jobType !== 'consolidated' && data.buyer?.email) {
    await sendInvoiceEmail(merchant, {
      customerEmail: data.buyer.email,
      customerName:  data.buyer.name || 'Valued Customer',
      orderNumber:   data.orderNumber || data.refNumber,
      qrCodeUrl:     result.qrCodeUrl,
      uuid:          result.uuid,
      invoiceType:   jobType,
    }).catch(err =>
      console.error(`[Worker] Email failed for ${data.orderNumber}: ${err.message}`)
    );
  }

  console.log(`[Worker] ✅ Done — merchant="${merchantId}" uuid="${result.uuid}"`);
  return result;

}, {
  connection,
  concurrency: 5, // 5 concurrent jobs across all merchants
});

// ── On job failure (after all retries exhausted) ──────────────────────────
worker.on('failed', async (job, err) => {
  if (!job || job.attemptsMade < job.opts.attempts) return;

  const { merchantId, orderNumber, refNumber } = job.data;
  console.error(
    `[Worker] ❌ Job ${job.id} exhausted retries — merchant="${merchantId}" error="${err.message}"`
  );

  let merchantName = merchantId;
  let m_id = null;
  try {
    const m = await merchantService.getMerchant(merchantId);
    merchantName = m.name;
    m_id = m.id;
  } catch {}

  // Move to DLQ
  await dlqQueue.add('failed-invoice', {
    merchantId,
    originalJob: { id: job.id, type: job.name, data: job.data },
    error:       { message: err.message, stack: err.stack },
    failedAt:    new Date().toISOString(),
  }).catch(() => {});

  // Persist to DB
  await db.saveFailedJob({
    merchantId:   m_id,
    jobId:        job.id,
    jobType:      job.name,
    orderNumber:  orderNumber || refNumber || null,
    error:        err.message,
    attempts:     job.attemptsMade,
    payload:      job.data,
  }).catch(() => {});

  // Alert ops team
  await sendFailureAlert({
    merchantId,
    merchantName,
    jobId:       job.id,
    jobType:     job.name,
    orderNumber: orderNumber || refNumber,
    error:       err.message,
    attempts:    job.attemptsMade,
  }).catch(() => {});
});

worker.on('error', err => console.error('[Worker] Uncaught error:', err.message));

console.log('[Worker] Multi-tenant invoice worker started (concurrency: 5)');
module.exports = { worker };
