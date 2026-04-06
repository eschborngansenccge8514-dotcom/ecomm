import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSupabaseClient } from "../_shared/supabase.ts";
import { EmailService } from "../_shared/resend.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * email-low-stock-alert
 * 
 * Triggered by: public.products (UPDATE)
 * Sends an alert email to the merchant when stock falls below threshold.
 */
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const product = payload.record;
    const oldProduct = payload.old_record;

    if (!product || !product.id || !product.merchant_id) {
       throw new Error('Invalid webhook payload');
    }

    const threshold = product.restock_threshold || product.low_stock_alert || 0;

    // Only send if stock has fallen below threshold and it was previously above or it just dropped further
    // (To avoid repeated alerts on every update if it's already low, maybe add a check?)
    // Basic logic: trigger if current stock <= threshold AND (previous > threshold OR it's the first time we check)
    const isNowLow = product.stock_quantity <= threshold;
    const wasAbove = oldProduct ? oldProduct.stock_quantity > threshold : true;

    if (!isNowLow || !wasAbove) {
      return new Response(JSON.stringify({ success: true, message: 'Stock level okay or already alerted' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseClient();

    // 1. Fetch merchant details
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', product.merchant_id)
      .single();

    if (merchantError) throw merchantError;
    if (!merchant) throw new Error('Merchant not found');

    // 2. Initialize EmailService
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) throw new Error('Missing RESEND_API_KEY environment variable');

    const emailService = new EmailService(resendKey);

    // 3. Send alert email to merchant
    const result = await emailService.sendLowStockAlert(merchant, product);

    console.log(`[email-low-stock-alert] Result for product ${product.name}:`, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[email-low-stock-alert] Error: ${message}`);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
