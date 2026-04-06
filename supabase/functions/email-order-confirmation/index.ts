import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase.ts";
import { EmailService } from "../_shared/resend.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * email-order-confirmation
 * 
 * Triggered by: public.orders (INSERT)
 * Sends a confirmation email to the customer.
 */
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const order = payload.record; // The NEW record from Supabase webhook

    if (!order || !order.id || !order.merchant_id) {
       throw new Error('Invalid webhook payload: missing order or merchant info');
    }

    const supabase = getSupabaseClient();

    // 1. Fetch order items with product details
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    if (itemsError) throw itemsError;

    // 2. Fetch merchant details
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', order.merchant_id)
      .single();

    if (merchantError) throw merchantError;
    if (!merchant) throw new Error('Merchant not found');

    // 3. Fetch customer profile if buyer_email is missing
    let fullOrder = { ...order };
    if (!order.buyer_email && order.customer_id) {
       const { data: profile } = await supabase
         .from('profiles')
         .select('email')
         .eq('id', order.customer_id)
         .single();
       if (profile) {
         fullOrder.profiles = profile;
       }
    }

    // 4. Initialize EmailService
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) throw new Error('Missing RESEND_API_KEY environment variable');

    const emailService = new EmailService(resendKey);

    // 5. Send email
    const result = await emailService.sendOrderConfirmation(merchant, fullOrder, items || []);

    console.log(`[email-order-confirmation] Result for order ${order.order_number}:`, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[email-order-confirmation] Error: ${error.message}`);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
