import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase.ts";
import { EmailService } from "../_shared/resend.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * email-order-status-update
 * 
 * Triggered by: public.orders (UPDATE)
 * Sends an update email when the status changes.
 */
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const order = payload.record;
    const oldOrder = payload.old_record;

    if (!order || !order.id || !order.merchant_id) {
       throw new Error('Invalid webhook payload');
    }

    // Only send if status has changed
    if (oldOrder && order.status === oldOrder.status) {
      return new Response(JSON.stringify({ success: true, message: 'Status unchanged' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseClient();

    // 1. Fetch merchant details
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', order.merchant_id)
      .single();

    if (merchantError) throw merchantError;
    if (!merchant) throw new Error('Merchant not found');

    // 2. Fetch customer profile if buyer_email is missing
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

    // 3. Initialize EmailService
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) throw new Error('Missing RESEND_API_KEY environment variable');

    const emailService = new EmailService(resendKey);

    // 4. Send email
    const result = await emailService.sendOrderStatusUpdate(merchant, fullOrder);

    console.log(`[email-order-status-update] Result for order ${order.order_number}:`, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[email-order-status-update] Error: ${message}`);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
