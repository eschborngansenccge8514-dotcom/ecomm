import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildLalamoveHeaders, getLalamoveBaseUrl } from "../_shared/lalamove-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let body;
    try {
      body = await req.json();
    } catch (e) {
      throw new Error("Invalid JSON body");
    }

    let { merchantId, apiKey, apiSecret, environment, market } = body;

    // Use platform secrets if not provided (for testing the global config)
    const finalApiKey = apiKey || Deno.env.get("LALAMOVE_API_KEY");
    const finalApiSecret = apiSecret || Deno.env.get("LALAMOVE_API_SECRET");
    const finalEnvironment = environment || Deno.env.get("DELIVERY_ENV") || "sandbox";
    const finalMarket = market || Deno.env.get("LALAMOVE_MARKET") || "MY_KUL";

    if (!finalApiKey || !finalApiSecret) {
      throw new Error("Lalamove credentials not found (neither in request nor in platform secrets)");
    }

    const baseUrl = getLalamoveBaseUrl(finalEnvironment);
    const method = "GET";
    const path = "/v3/cities"; 
    
    // For Market header, v3 usually expects the country code (e.g. 'MY' instead of 'MY_KUL')
    const countryMarket = finalMarket.includes('_') ? finalMarket.split('_')[0] : finalMarket;

    console.log(`[lalamove-test-connection] Testing ${apiKey ? 'provided' : 'platform'} keys for ${merchantId} in ${countryMarket} (${finalEnvironment})`);

    const headers = await buildLalamoveHeaders(
      finalApiKey,
      finalApiSecret,
      method,
      path,
      "",
      countryMarket
    );


    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: headers as any,
    });

    const resultBody = await response.text();
    let isSuccess = response.ok;
    let testResult = isSuccess ? "success" : `failed: ${resultBody.substring(0, 100)}`;

    console.log(`[lalamove-test-connection] Lalamove status: ${response.status}`);

    // Update the database with the result
    const { error: updateError } = await supabaseClient
      .from("merchant_lalamove_config")
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_result: testResult,
      })
      .eq("merchant_id", merchantId);

    if (updateError) {
      console.error("[lalamove-test-connection] DB update error:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: isSuccess,
        message: isSuccess ? "Connection successful" : `Connection failed: ${testResult}`,
        details: resultBody,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: isSuccess ? 200 : 400,
      }
    );
  } catch (error: any) {
    console.error("[lalamove-test-connection] Error:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

