import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase.ts";
import { EmailService } from "../_shared/resend.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * email-merchant-new-order
 * 
 * Triggered by: public.orders (INSERT)
 * Sends an alert email to the merchant.
 */
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const order = payload.record;

    if (!order || !order.id || !order.merchant_id) {
       throw new Error('Invalid webhook payload');
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

    // 2. Initialize EmailService
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) throw new Error('Missing RESEND_API_KEY environment variable');

    const emailService = new EmailService(resendKey);

    // 3. Send email to merchant
    const result = await emailService.sendMerchantNewOrderAlert(merchant, order);

    console.log(`[email-merchant-new-order] Result for merchant ${merchant.email} on order ${order.order_number}:`, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[email-merchant-new-order] Error: ${message}`);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
