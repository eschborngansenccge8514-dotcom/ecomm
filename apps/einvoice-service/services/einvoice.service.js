const db        = require('../db/invoice.db');
const merchant  = require('./merchant.service');
const builder     = require('./builder');
const signer      = require('./signer');
const submitter   = require('./submitter');
const eligibility = require('./eligibility');
const config      = require('../config');

/**
 * Handle a new order: Decide whether to issue individual e-invoice 
 * or stage it for monthly consolidation.
 */
async function processIncomingOrder(merchantUid, orderData) {
  const m = await merchant.getMerchant(merchantUid);
  
  // 1. Run eligibility check
  const check = eligibility.checkEligibility(orderData, m);
  
  if (check.eligible) {
    // Stage for consolidated e-invoice
    const now = new Date();
    await db.stageForConsolidated({
      merchantId:     m.id,
      orderNumber:    orderData.orderNumber,
      subtotal:       orderData.subtotal,
      tax:            orderData.tax || 0,
      year:           orderData.year  || now.getFullYear(),
      month:          orderData.month || (now.getMonth() + 1),
      isRestricted:   false
    });
    
    return { success: true, status: 'staged', message: 'Order staged for consolidation' };
  } else {
    // Must issue individual e-invoice
    console.log(`[Service] Issue individual: ${check.reason}`);
    const result = await issueInvoice(m.id, orderData); // issueInvoice handles merchant object or ID
    
    // Also record it in staging but marked as restricted so it's excluded from consolidated preview
    const now = new Date();
    await db.stageForConsolidated({
      merchantId:     m.id,
      orderNumber:    orderData.orderNumber,
      subtotal:       orderData.subtotal,
      tax:            orderData.tax || 0,
      year:           orderData.year  || now.getFullYear(),
      month:          orderData.month || (now.getMonth() + 1),
      isRestricted:   true,
      exclusionReason: check.reason
    });
    
    return { success: true, status: 'issued', data: result };
  }
}

/**
 * Upgrade a staged order to an individual e-invoice if requested by buyer.
 */
async function requestIndividualInvoice(merchantUid, orderNumber) {
  const m = await merchant.getMerchant(merchantUid);
  
  // 1. Mark in DB as requested individual
  await db.markAsIndividualRequested(m.id, orderNumber);
  
  // 2. Fetch order details from whatever source (omitted here, assuming payload is in DB or passed)
  // In a real app, we'd fetch the original order data.
  // Then call issueInvoice(m.id, orderData);
  
  return { success: true, message: 'Order marked for individual submission' };
}

/**
 * Issue and submit an invoice (or note).
 */
async function issueInvoice(merchantUid, invoiceData, type = '01') {
  const m = typeof merchantUid === 'object' ? merchantUid : await merchant.getMerchant(merchantUid);
  
  const unsigned = builder.buildInvoice(m, {
    ...invoiceData,
    invoiceNumber: invoiceData.invoiceNumber || invoiceData.orderNumber
  }, type);

  const { signedInvoice, docDigest } = signer.signDocument(unsigned, m);
  
  let lhdnResponse;
  try {
    lhdnResponse = await submitter.submitInvoice(m, invoiceData.orderNumber, signedInvoice, docDigest);
  } catch (err) {
    // Even if submission fails (e.g. 429), we record it as 'failed' in our DB
    await db.createInvoice({
      merchantId:     m.id,
      orderNumber:    invoiceData.orderNumber,
      status:         'failed',
      errorMessage:   err.message,
    }).catch(() => {});
    throw err;
  }

  const invoiceRecord = await db.createInvoice({
    merchantId:     m.id,
    orderNumber:    invoiceData.orderNumber,
    submissionUid:  lhdnResponse.submissionUID,
    lhdnUuid:       lhdnResponse.uuid,
    lhdnLongId:     lhdnResponse.longId,
    status:         'submitted',
  });

  // Malaysia Tax Compliance: Trigger accounting post for the new invoice
  // This ensures Accounts Receivable (1200) and Revenue (4000) are updated automatically.
  await triggerAccountingPost('invoice.issued', {
    ...invoiceRecord,
    subtotal: invoiceData.subtotal,
    tax:      invoiceData.tax || 0,
    total:    invoiceData.total || (invoiceData.subtotal + (invoiceData.tax || 0))
  });

  return { 
    ...invoiceRecord, 
    qrCodeUrl: lhdnResponse.longId ? `${config.URLS[config.ENV].API}/documents/${lhdnResponse.uuid}/details` : null 
  };
}

/**
 * Internal helper to trigger the accounting engine auto-poster.
 */
async function triggerAccountingPost(type, record) {
  // We use the Supabase Edge Function as the entry point for cross-service accounting posts
  const endpoint = process.env.SUPABASE_URL + '/functions/v1/accounting-auto-post';
  const apiKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!endpoint || !apiKey) return;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ type, record })
    });
    if (!res.ok) console.warn(`[Accounting Linkage] RPC failed: ${res.status} ${res.statusText}`);
  } catch (err) {
    console.warn(`[Accounting Linkage] Trigger failed: ${err.message}`);
  }
}

/**
 * Issue and submit a consolidated invoice for a merchant's monthly B2C sales.
 */
async function issueConsolidatedInvoice(merchantUid, { year, month }) {
  const m = await merchant.getMerchant(merchantUid);
  
  // 1. Fetch eligible staged orders
  const orders = await db.getStagedConsolidatedOrders(m.id, year, month);
  if (orders.length === 0) {
    throw new Error('No eligible staged orders found for this period');
  }

  // 2. Build consolidated document
  const unsigned = builder.buildConsolidatedInvoice(m, year, month, orders);
  const { signedInvoice, docDigest } = signer.signDocument(unsigned, m);
  
  // 3. Submit to LHDN
  const invoiceNumber = `CON-MS-${m.id}-${year}${String(month).padStart(2, '0')}`;
  const lhdnResponse = await submitter.submitInvoice(m, invoiceNumber, signedInvoice, docDigest);

  const invoiceRecord = await db.createInvoice({
    merchantId:     m.id,
    orderNumber:    invoiceNumber,
    submissionUid:  lhdnResponse.submissionUID,
    lhdnUuid:       lhdnResponse.uuid,
    lhdnLongId:     lhdnResponse.longId,
    status:         'submitted',
  });

  // 4. Mark all orders as consolidated in the staging table
  await db.markOrdersConsolidated(m.id, orders.map(o => o.orderNumber), invoiceRecord.id);

  return invoiceRecord;
}

/**
 * Note issuing methods
 */
async function issueCreditNote(merchantUid, data) {
  return issueInvoice(merchantUid, { ...data, orderNumber: data.refNumber }, '02');
}

async function issueDebitNote(merchantUid, data) {
  return issueInvoice(merchantUid, { ...data, orderNumber: data.refNumber }, '03');
}

async function issueRefundNote(merchantUid, data) {
  return issueInvoice(merchantUid, { ...data, orderNumber: data.refNumber }, '04');
}

/**
 * Cancel an invoice
 */
async function cancelInvoice(merchantUid, uuid, reason, orderNumber) {
  const m = await merchant.getMerchant(merchantUid);
  console.log(`[Service] Cancel request for ${uuid} (Merchant: ${merchantUid}) - Reason: ${reason}`);
  
  // Real implementaton would call LHDN /documents/state/{uuid} DELETE
  // For the test, we just update the DB
  await db.updateInvoice(m.id, orderNumber, { status: 'cancelled' });
  
  return { success: true };
}

module.exports = {
  processIncomingOrder,
  requestIndividualInvoice,
  issueInvoice,
  issueConsolidatedInvoice,
  issueCreditNote,
  issueDebitNote,
  issueRefundNote,
  cancelInvoice,
};
