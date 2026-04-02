require('dotenv').config();
const { pool } = require('../db/pool');
const merchantService = require('../services/merchant.service');
const einvoice = require('../services/einvoice.service');

/**
 * Script to pick up individual e-invoice requests from public.orders
 * and submit them to LHDN immediately.
 */
async function processIndividualRequests() {
  console.log('🔄 Checking for individual e-invoice requests...');
  const client = await pool.connect();
  
  try {
    // 1. Fetch orders needing individual e-invoice
    const { rows: orders } = await client.query(`
      SELECT o.id, o.order_number, o.subtotal, o.tax_amount, o.merchant_id, 
             o.einvoice_details, o.einvoice_status, o.total_amount,
             o.items, o.delivery_address
      FROM public.orders o
      WHERE o.einvoice_status IN ('needs_einvoice_now', 'converted_to_individual')
    `);
    
    if (orders.length === 0) {
      console.log('✅ No individual requests found.');
      return;
    }
    
    console.log(`Found ${orders.length} individual requests to process.`);

    for (const o of orders) {
      console.log(`Processing individual invoice for order ${o.order_number}...`);
      
      try {
        const m = await merchantService.getMerchant(o.merchant_id);
        
        // Map order items to builder format
        const items = (o.items || []).map(item => ({
          description: item.product_name + (item.variant_name ? ` (${item.variant_name})` : ''),
          quantity: item.quantity,
          unitPrice: item.unit_price,
          subtotal: item.line_total,
          tax: 0, // Simplified tax handling for now
          unitCode: 'C62'
        }));

        const buyerDetails = o.einvoice_details || {};
        const deliveryAddr = o.delivery_address || {};

        const buyer = {
          tin:      buyerDetails.tin || 'EI00000000010',
          brn:      buyerDetails.id_no || 'NA',
          name:     buyerDetails.name || deliveryAddr.name || 'Individual Customer',
          phone:    buyerDetails.phone || deliveryAddr.phone || '00-00000000',
          email:    buyerDetails.email || 'noreply@customer.com',
          address:  deliveryAddr.line1 || 'N/A',
          postcode: deliveryAddr.postcode || '00000',
          city:     deliveryAddr.city || 'N/A',
          state:    deliveryAddr.state || '14',
          country:  'MYS'
        };

        // Issue individual invoice
        console.log(`Issuing individual e-Invoice for order ${o.order_number}...`);
        await einvoice.issueInvoice(m.id, {
          orderNumber: o.order_number,
          buyer,
          items,
          subtotal: o.subtotal,
          tax: o.tax_amount || 0
        });

        // Update order status to individual_issued
        await client.query(`
          UPDATE public.orders 
          SET einvoice_status = 'individual_issued' 
          WHERE id = $1
        `, [o.id]);

        console.log(`✅ Successfully issued individual e-Invoice for order ${o.order_number}`);

      } catch (err) {
        console.error(`❌ Error processing individual order ${o.order_number}:`, err.message);
      }
    }
    
  } catch (err) {
    console.error('❌ Critical processing error:', err.stack);
  } finally {
    client.release();
  }
}

// Export for cron/automation
module.exports = { processIndividualRequests };

// If run directly
if (require.main === module) {
  processIndividualRequests().then(() => pool.end());
}
