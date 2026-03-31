const config = require('../config');
const auth   = require('./auth');
const db     = require('../db/invoice.db');
const { pool } = require('../db/pool');
const crypto = require('crypto');

function getApiBase(merchant) {
  return config.getURLs(merchant).API;
}

/**
 * Submit a signed invoice to LHDN MyInvois API
 */
async function submitInvoice(merchant, invoiceNumber, signedInvoiceJson, documentHash = '') {
  const start = Date.now();
  const url   = `${getApiBase(merchant)}/documentsubmissions`;

  let responseBody, statusCode;

  try {
    const headers = await auth.apiHeaders(merchant);

    const docString = JSON.stringify(signedInvoiceJson);
    
    // LHDN REQUIREMENT: "document" property must be BASE64 ENCODED version of the JSON string
    const b64Document = Buffer.from(docString, 'utf8').toString('base64');
    
    // documentHash is the SHA256 of the ORIGINAL string (Base64 of the digest)
    const calculatedHash = crypto.createHash('sha256').update(docString, 'utf8').digest('base64');
    
    console.log(`[DEBUG] Final Document Hash: ${calculatedHash}`);
    require('fs').writeFileSync('/tmp/lhdn_request.json', docString); // Save raw for inspection

    const res = await fetch(url, {
      method:  'POST',
      headers,
      body: JSON.stringify({
        documents: [{
          format:          'JSON',
          document:        b64Document,
          documentHash:    calculatedHash, 
          codeNumber:      invoiceNumber,
        }],
      }),
    });

    statusCode   = res.status;
    responseBody = await res.json();

    if (!res.ok) {
      throw new Error(`Submission failed [${res.status}]: ${JSON.stringify(responseBody)}`);
    }

    const result = responseBody.acceptedDocuments?.[0] || responseBody;

    await db.auditLog({
      orderNumber:  invoiceNumber,
      merchantId:   merchant.id,
      action:       'submission',
      endpoint:     url,
      requestBody:  { invoiceNumber },
      responseBody,
      statusCode,
      durationMs:   Date.now() - start,
    }).catch(console.error);

    if (merchant.env === 'production') {
      await pool.query(`
        INSERT INTO einvoice_production_log 
          (merchant_id, order_number, lhdn_uuid, lhdn_long_id, invoice_type, amount)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        merchant.id, invoiceNumber, result.uuid, result.longId, 
        '01', 1.0 
      ]).catch(console.error);
    }

    return result;

  } catch (err) {
    await db.auditLog({
      orderNumber:  invoiceNumber,
      merchantId:   merchant.id,
      action:       'submission_error',
      endpoint:     url,
      requestBody:  { invoiceNumber },
      responseBody: responseBody || { error: err.message },
      statusCode:   statusCode || 0,
      durationMs:   Date.now() - start,
    }).catch(console.error);

    throw err;
  }
}

module.exports = { submitInvoice };
