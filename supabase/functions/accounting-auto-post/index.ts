import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { postPOSSale, postInvoicePayment, postInvoice, postPayroll, postOrderSale } from "accounting/index.ts";
import { corsHeaders } from "shared/cors.ts";

/**
 * accounting-auto-post
 * 
 * listens for business events (via Supabase Webhooks) and posts 
 * corresponding journal entries.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json();
    console.log('[accounting-auto-post] Received event:', payload.type);

    const { type, record } = payload;

    let result;
    switch (type) {
      case 'pos.transaction.completed':
        // Mapping Supabase table columns to the accounting engine input
        result = await postPOSSale({
          merchantId: record.merchant_id,
          totalAmount: Number(record.total_amount),
          subtotal: Number(record.subtotal_amount || record.total_amount),
          sstAmount: Number(record.sst_amount || 0),
          cogsAmount: Number(record.cogs_amount || 0),
          createdAt: new Date(record.created_at),
          txnRef: record.order_number || record.id,
          paymentMethod: record.payment_method || 'cash',
          gatewayFee: Number(record.gateway_fee || 0),
        });
        break;

      case 'invoice.payment.received':
        result = await postInvoicePayment({
          merchantId: record.merchant_id,
          amount: Number(record.amount),
          invoiceId: record.invoice_id,
          paymentRef: record.payment_ref || record.id,
          date: new Date(record.payment_date || record.created_at),
        });
        break;

      case 'invoice.issued':
        result = await postInvoice({
          merchantId: record.merchantId,
          invoiceId:  record.id || record.orderNumber,
          subtotal:   Number(record.subtotal),
          tax:        Number(record.tax),
          total:      Number(record.total),
          date:       new Date(record.created_at || new Date()),
        });
        break;

      case 'order.paid':
        result = await postOrderSale({
          merchantId: record.merchant_id,
          orderId:    record.id,
          orderNo:    record.order_number,
          total:      Number(record.total_amount),
          subtotal:   Number(record.subtotal),
          tax:        Number(record.tax_amount || 0),
          delivery:   Number(record.delivery_fee || 0),
          discount:   Number(record.discount_amount || 0),
          cogs:       Number(record.cogs_amount || 0), 
          date:       new Date(record.paid_at || record.created_at),
          paymentMethod: record.payment_method,
          isMarketplace: !!record.marketplace_order_id || !!record.external_id
        });
        break;

      case 'payroll.completed':
        result = await postPayroll({
          merchantId:  record.merchant_id,
          totalGross:  Number(record.total_gross),
          totalNet:    Number(record.total_net),
          epf_ee:      Number(record.epf_ee),
          epf_er:      Number(record.epf_er),
          socso_ee:    Number(record.socso_ee),
          socso_er:    Number(record.socso_er),
          eis_ee:      Number(record.eis_ee),
          eis_er:      Number(record.eis_er),
          pcb:         Number(record.pcb),
          date:        new Date(record.payment_date || new Date()),
          reference:   record.id || record.reference,
        });
        break;

      default:
        console.warn('[accounting-auto-post] Unhandled event type:', type);
        return new Response(JSON.stringify({ message: 'Unhandled event type' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error(`[accounting-auto-post] Error: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
