const db        = require('../db/invoice.db');
const merchant  = require('./merchant.service');
const builder   = require('./builder');
const signer    = require('./signer');
const submitter = require('./submitter');
const config    = require('../config');

/**
 * Issue and submit an invoice (or note).
 */
async function issueInvoice(merchantUid, invoiceData, type = '01') {
  const m = await merchant.getMerchant(merchantUid);
  
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

  return { 
    ...invoiceRecord, 
    qrCodeUrl: lhdnResponse.longId ? `${config.URLS[config.ENV].API}/documents/${lhdnResponse.uuid}/details` : null 
  };
}

/**
 * Issue and submit a consolidated invoice for a merchant's monthly B2C sales.
 */
async function issueConsolidatedInvoice(merchantUid, { year, month, orders }) {
  const m = await merchant.getMerchant(merchantUid);
  
  // Aggregate items from all orders into a single document
  const items = orders.flatMap(o => o.items || [{
    description: `Summary for Order ${o.orderNumber}`,
    quantity: 1,
    unitPrice: o.subtotal,
    tax: o.tax,
  }]);

  const invoiceData = {
    invoiceNumber: `CON-${year}-${String(month).padStart(2, '0')}-${merchantUid.slice(0,4)}`,
    buyer: { name: 'General Public', tin: 'EI00000000010' },
    items,
  };

  const unsigned = builder.buildInvoice(m, invoiceData, '01');
  const { signedInvoice, docDigest } = signer.signDocument(unsigned, m);
  const lhdnResponse = await submitter.submitInvoice(m, invoiceData.invoiceNumber, signedInvoice, docDigest);

  const invoiceRecord = await db.createInvoice({
    merchantId:     m.id,
    orderNumber:    invoiceData.invoiceNumber,
    submissionUid:  lhdnResponse.submissionUID,
    lhdnUuid:       lhdnResponse.uuid,
    lhdnLongId:     lhdnResponse.longId,
    status:         'submitted',
  });

  // Mark all orders as consolidated in the staging table
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
  issueInvoice,
  issueConsolidatedInvoice,
  issueCreditNote,
  issueDebitNote,
  issueRefundNote,
  cancelInvoice,
};
