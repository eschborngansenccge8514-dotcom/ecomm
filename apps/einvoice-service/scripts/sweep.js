require('dotenv').config();
const { pool } = require('../db/pool');
const merchantService = require('../services/merchant.service');
const builder = require('../services/builder');
const signer = require('../services/signer');
const submitter = require('../services/submitter');
const db = require('../db/invoice.db');

/**
 * Sweep script to consolidate pending_buyer_request orders.
 * @param {string|null} merchantId  - Filter to a single merchant UUID (null = all merchants)
 * @param {boolean} includeCurrentMonth - If true, include orders from the current month too (for manual triggers)
 */
async function runSweep(merchantId = null, includeCurrentMonth = false) {
  console.log(`🔄 Starting E-Invoice Consolidation Sweep${merchantId ? ` for merchant ${merchantId}` : ''}...`);
  const client = await pool.connect();
  
  try {
    const queryParams = [];
    let queryStr = `
      SELECT o.id, o.order_number, o.subtotal, o.tax_amount, o.merchant_id, o.created_at
      FROM public.orders o
      WHERE o.einvoice_status = 'pending_buyer_request'
    `;

    if (!includeCurrentMonth) {
      queryStr += ` AND o.created_at < date_trunc('month', now())`;
    }
    
    if (merchantId) {
      queryStr += ` AND o.merchant_id = $${queryParams.length + 1}`;
      queryParams.push(merchantId);
    }
    
    const { rows: orders } = await client.query(queryStr, queryParams);
    
    if (orders.length === 0) {
      console.log('✅ No pending orders to consolidate.');
      return { success: true, processed: 0, message: 'No pending orders found for the previous month.' };
    }
    
    console.log(`Found ${orders.length} orders to consolidate.`);

    // 2. Group by merchant_id
    const grouped = {};
    for (const o of orders) {
      if (!grouped[o.merchant_id]) {
        grouped[o.merchant_id] = [];
      }
      grouped[o.merchant_id].push(o);
    }

    // 3. Process each merchant
    for (const [merchantUid, merchantOrders] of Object.entries(grouped)) {
      console.log(`Processing ${merchantOrders.length} orders for merchant ${merchantUid}`);
      
      try {
        // Fetch merchant config using merchant_uid
        const { rows: mRows } = await client.query(`SELECT id FROM einvoicing.merchants WHERE merchant_uid = $1`, [merchantUid]);
        if (mRows.length === 0) {
          console.error(`❌ Merchant not found in einvoicing config: ${merchantUid}`);
          continue;
        }
        
        const m = await merchantService.getMerchant(merchantUid);
        
        // Use current year and month for the consolidated invoice
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        // Map orders to expected format for builder
        const mappedOrders = merchantOrders.map(o => ({
          orderNumber: o.order_number,
          subtotal: o.subtotal,
          tax: o.tax_amount || 0
        }));

        // Build & Sign
        const unsigned = builder.buildConsolidatedInvoice(m, year, month, mappedOrders);
        const { signedInvoice, docDigest } = signer.signDocument(unsigned, m);
        
        // Submit to LHDN
        const invoiceNumber = `CON-MS-${m.id}-${year}${String(month).padStart(2, '0')}-${Date.now()}`;
        console.log(`Submitting consolidated invoice ${invoiceNumber}...`);
        
        let lhdnResponse;
        try {
          lhdnResponse = await submitter.submitInvoice(m, invoiceNumber, signedInvoice, docDigest);
        } catch (submitErr) {
          console.error(`❌ LHDN submission failed for merchant ${merchantUid}: ${submitErr.message}`);
          continue;
        }

        // Record in einvoicing.einvoices
        const invoiceRecord = await db.createInvoice({
          merchantId: m.id,
          orderNumber: invoiceNumber,
          submissionUid: lhdnResponse.submissionUID,
          lhdnUuid: lhdnResponse.uuid,
          lhdnLongId: lhdnResponse.longId,
          status: 'submitted',
        });

        // 4. Update orders in public.orders to 'sent_to_consolidated_batch'
        const orderIds = merchantOrders.map(o => o.id);
        await client.query(`
          UPDATE public.orders 
          SET einvoice_status = 'sent_to_consolidated_batch' 
          WHERE id = ANY($1)
        `, [orderIds]);

        console.log(`✅ Successfully consolidated and submitted for merchant ${merchantUid} (DB ID: ${invoiceRecord.id})`);

      } catch (merchErr) {
        console.error(`❌ Error processing merchant ${merchantUid}: ${merchErr.message}`);
      }
    }
    
    console.log('🎉 Sweep completed successfully!');
    return { success: true, processed: Object.keys(grouped).length };
  } catch (err) {
    console.error('❌ Critical Sweep Error:', err);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { runSweep };
