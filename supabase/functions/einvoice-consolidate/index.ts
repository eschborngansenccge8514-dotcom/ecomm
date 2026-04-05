import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { getLhdnToken, submitToLhdn, buildUblJson } from "../_shared/lhdn.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { merchant_id, year, month } = await req.json();

    if (!merchant_id || !year || !month) {
      throw new Error("Missing merchant_id, year, or month");
    }

    // 1. Fetch Merchant Config
    const { data: config, error: configError } = await supabaseClient
      .from("merchant_einvoice_config")
      .select("*")
      .eq("merchant_id", merchant_id)
      .single();

    if (configError || !config) throw new Error("Merchant config not found.");

    // 2. Fetch Merchant Details
    const { data: merchant } = await supabaseClient.from("merchants").select("*").eq("id", merchant_id).single();
    if (!merchant) throw new Error("Merchant details not found.");

    // 3. Fetch Pending Orders
    const monthPadded = String(month).padStart(2, "0");
    const startDate = `${year}-${monthPadded}-01T00:00:00Z`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${monthPadded}-${lastDay}T23:59:59Z`;

    const { data: orders, error: ordersError } = await supabaseClient
      .from("orders")
      .select("id, order_number, subtotal, tax_amount, total_amount, created_at, delivery_fee")
      .eq("merchant_id", merchant_id)
      .eq("einvoice_status", "pending_buyer_request")
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (ordersError) throw new Error(`Error fetching orders: ${ordersError.message}`);
    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: "No pending orders" }), { headers: jsonHeaders });
    }

    // 4. Build & Submit
    const invoiceNumber = `CON-MS-${merchant_id.substring(0, 8)}-${year}${monthPadded}`;
    const token = await getLhdnToken(config);
    const payload = buildUblJson(config, merchant, orders, invoiceNumber, 'consolidated');

    // Audit Log
    const { data: auditLog } = await supabaseClient.from("einvoice_audit_log").insert({
      merchant_id,
      action: "consolidation",
      endpoint: "documentsubmissions",
      request_body: { invoice_number: invoiceNumber, payload, orders_count: orders.length },
      status_code: 0,
    }).select().single();

    try {
      const lhdnResponse = await submitToLhdn(config, invoiceNumber, payload, token);
      
      if (auditLog) {
         await supabaseClient.from("einvoice_audit_log").update({ response_body: lhdnResponse, status_code: 200 }).eq("id", auditLog.id);
      }

      // Record einvoice
      const totalAmount = orders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
      await supabaseClient.from("einvoices").insert({
        merchant_id,
        order_number: invoiceNumber,
        submission_uid: lhdnResponse.submissionUid || lhdnResponse.uuid,
        lhdn_uuid: lhdnResponse.uuid,
        status: "submitted",
        invoice_type: "11",
        total_amount: totalAmount,
        orders_count: orders.length,
        submitted_at: new Date().toISOString()
      });

      // Update orders
      await supabaseClient.from("orders").update({ einvoice_status: "sent_to_consolidated_batch" }).in("id", orders.map(o => o.id));

      return new Response(JSON.stringify({ success: true, processed: orders.length }), { headers: jsonHeaders });
    } catch (lhdnErr: any) {
      if (auditLog) {
         await supabaseClient.from("einvoice_audit_log").update({ response_body: { error: lhdnErr.message }, status_code: 400 }).eq("id", auditLog.id);
      }
      throw lhdnErr;
    }
  } catch (error: any) {
    console.error("Edge Function Error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: jsonHeaders, status: 400 });
  }
});
