import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { customer_ids, type, channel, custom_message, merchant_id } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // 1. Fetch Customers
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, email, phone")
      .in("id", customer_ids)
      .eq('merchant_id', merchant_id);

    if (!customers) throw new Error("No customers found.");

    // 2. Logic to send notifications (mock for now)
    console.log(`Sending ${type} notification to ${customers.length} customers via ${channel}`);

    // In a real scenario, we'd loop and call SendGrid or Twilio/WhatsApp API
    const sentCount = customers.length;

    return new Response(JSON.stringify({ 
      success: true, 
      sent_to: sentCount,
      notification_type: type,
      channel 
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
});
