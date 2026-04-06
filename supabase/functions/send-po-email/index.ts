import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase.ts";
import { EmailService } from "../_shared/resend.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * send-po-email
 * 
 * Fetches purchase order details and merchant info, then emails the PO to the supplier.
 * Expected body: { po_id: string, merchant_id: string }
 */
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { po_id, merchant_id } = await req.json();
    if (!po_id || !merchant_id) {
       throw new Error('Missing po_id or merchant_id in request body');
    }

    const supabase = getSupabaseClient();

    // 1. Fetch PO data with items and supplier
    // We join purchase_order_items and products to get item names
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        suppliers (*),
        purchase_order_items (
          *,
          products (name)
        )
      `)
      .eq('id', po_id)
      .eq('merchant_id', merchant_id)
      .single();

    if (poError) throw poError;
    if (!po) throw new Error('Purchase order not found');
    if (!po.suppliers) throw new Error('Supplier details not found for this PO');

    // 2. Fetch merchant data for store name
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', merchant_id)
      .single();

    if (merchantError) throw merchantError;
    if (!merchant) throw new Error('Merchant profile not found');

    // 3. Initialize EmailService
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) throw new Error('Missing RESEND_API_KEY environment variable');

    const emailService = new EmailService(resendKey);

    // 4. Send email to supplier
    const result = await emailService.sendPurchaseOrderEmail(
        merchant,
        po,
        po.purchase_order_items,
        po.suppliers
    );

    console.log(`[send-po-email] Successfully sent PO #${po.po_number} to ${po.suppliers.email}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Purchase order email sent',
        data: result 
      }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[send-po-email] Error: ${error.message}`);
    return new Response(JSON.stringify({ 
        success: false,
        error: error.message 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
