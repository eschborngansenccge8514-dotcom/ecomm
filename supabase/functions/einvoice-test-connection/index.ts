import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = { 
  "Access-Control-Allow-Origin": "*", 
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" 
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { client_id, client_secret, env } = await req.json();

    if (!client_id || !client_secret) {
      throw new Error("Client ID and Client Secret are required");
    }

    const host = env === "production" 
      ? "https://api.myinvois.hasil.gov.my" 
      : "https://preprod-api.myinvois.hasil.gov.my";
    
    const url = `${host}/connect/token`;

    console.log(`[einvoice-test-connection] Testing ${env} authentication at ${url}`);

    const res = await fetch(url, { 
      method: "POST", 
      headers: { "Content-Type": "application/x-www-form-urlencoded" }, 
      body: new URLSearchParams({ 
        grant_type: "client_credentials", 
        client_id: client_id.trim(), 
        client_secret: client_secret.trim(), 
        scope: "InvoicingAPI" 
      }) 
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[einvoice-test-connection] Auth Failed: ${res.status}`, errorText);
      throw new Error(`Authentication Failed (${res.status}): Please check your Client ID and Secret.`);
    }

    const data = await res.json();
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Connected to LHDN successfully!",
      expires_in: data.expires_in
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    console.error("[einvoice-test-connection] Error:", error.message);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400 
    });
  }
});
