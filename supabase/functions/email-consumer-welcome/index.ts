import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { EmailService } from "../_shared/resend.ts";
import { corsHeaders } from "../_shared/cors.ts";

/**
 * email-consumer-welcome
 * 
 * Triggered by: auth.users (INSERT)
 * Sends a welcome email to the new consumer.
 */
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const user = payload.record;

    if (!user || !user.email) {
       throw new Error('Invalid webhook payload: missing user email');
    }

    // Initialize EmailService
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) throw new Error('Missing RESEND_API_KEY environment variable');

    const emailService = new EmailService(resendKey);

    // Send welcome email
    const result = await emailService.sendConsumerWelcome(user);

    console.log(`[email-consumer-welcome] Result for user ${user.email}:`, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[email-consumer-welcome] Error: ${message}`);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
