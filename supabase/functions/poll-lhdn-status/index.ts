import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Fetch all submissions still in 'submitted' state
  const { data: pending, error: pErr } = await admin
    .from('einvoice_submissions')
    .select('id, merchant_id, batch_id, lhdn_uuid, invoice_type, order_ids')
    .eq('status', 'submitted')
    .lt('submitted_at', new Date(Date.now() - 2 * 60 * 1000).toISOString()) // older than 2 min
    .limit(50)

  if (pErr) return new Response(JSON.stringify({ error: pErr.message }), { status: 500, headers: CORS })

  console.log(`Polling status for ${pending?.length ?? 0} submissions...`)

  for (const submission of pending ?? []) {
    try {
      // 1. Get Merchant Config
      const { data: config } = await admin
        .from('merchant_einvoice_config')
        .select('*')
        .eq('merchant_id', submission.merchant_id)
        .single()
      
      if (!config) continue

      // 2. Get LHDN Token
      const token = await getLhdnToken(config)

      // 3. Poll LHDN MyInvois API for submission result
      const lhdnResult = await getDocumentDetails(config, submission.lhdn_uuid, token)

      await admin
        .from('einvoice_submissions')
        .update({
          status:        lhdnResult.status.toLowerCase(), // 'valid' | 'invalid' | 'cancelled'
          lhdn_response: lhdnResult,
          error_codes:   lhdnResult.errors?.map((e: any) => e.code) ?? [],
          validated_at:  new Date().toISOString()
        })
        .eq('id', submission.id)

      // 4. Update the actual einvoices table if it's a single order
      if (submission.invoice_type === 'individual' && submission.order_ids.length === 1) {
        await admin
          .from('einvoices')
          .update({
            status: lhdnResult.status.toLowerCase(),
            validated_at: new Date().toISOString()
          })
          .eq('lhdn_uuid', submission.lhdn_uuid)
      }

    } catch (err) {
      console.error(`Poll failed for submission ${submission.id}:`, err)
    }
  }

  return new Response(JSON.stringify({ success: true, polled: pending?.length ?? 0 }), { headers: CORS })
})

async function getLhdnToken(config: any) {
  const url = config.env === "production" ? "https://api.myinvois.hasil.gov.my/connect/token" : "https://preprod-api.myinvois.hasil.gov.my/connect/token";
  const res = await fetch(url, { 
    method: "POST", 
    headers: { "Content-Type": "application/x-www-form-urlencoded" }, 
    body: new URLSearchParams({ 
      grant_type: "client_credentials", 
      client_id: config.client_id, 
      client_secret: config.client_secret, 
      scope: "InvoicingAPI" 
    }) 
  });
  if (!res.ok) throw new Error(`Token Auth Failed: ${res.status}.`);
  const data = await res.json();
  return data.access_token;
}

async function getDocumentDetails(config: any, uuid: string, token: string) {
  const url = config.env === "production" 
    ? `https://api.myinvois.hasil.gov.my/api/v1.0/documents/${uuid}` 
    : `https://preprod-api.myinvois.hasil.gov.my/api/v1.0/documents/${uuid}`;
  
  const res = await fetch(url, { 
    method: "GET", 
    headers: { "Authorization": `Bearer ${token}` } 
  });
  
  if (!res.ok) throw new Error(`LHDN lookup failed: ${res.status}`)
  return await res.json();
}
