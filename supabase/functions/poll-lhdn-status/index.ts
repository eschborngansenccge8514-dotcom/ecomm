import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch pending from einvoice_submissions table
    const { data: pending, error: pErr } = await admin
      .from('einvoice_submissions')
      .select('id, merchant_id, batch_id, lhdn_uuid, invoice_type, order_ids')
      .eq('status', 'submitted')
      .lt('submitted_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
      .limit(20)

    if (pErr) throw pErr

    // Also fetch from einvoices table (from einvoice-submit edge function)
    const { data: pendingLegacy, error: lErr } = await admin
      .from('einvoices')
      .select('id, merchant_id, lhdn_uuid, submission_uid, order_id')
      .eq('status', 'submitted')
      .not('lhdn_uuid', 'is', null)
      .limit(20)
    
    if (lErr) throw lErr

    // Normalize into a consistent shape
    const allPending: any[] = [
      ...(pending || []).map((p: any) => ({ 
        id: p.id,
        merchant_id: p.merchant_id,
        submission_id: p.batch_id,
        doc_uuid: p.lhdn_uuid,
        table: 'einvoice_submissions',
        order_ids: p.order_ids || []
      })),
      ...(pendingLegacy || []).map((p: any) => ({ 
        id: p.id,
        merchant_id: p.merchant_id,
        submission_id: p.submission_uid,
        doc_uuid: p.lhdn_uuid,
        table: 'einvoices', 
        order_ids: p.order_id ? [p.order_id] : [] 
      }))
    ]

    console.log(`Polling status for ${allPending.length} submissions...`)

    for (const submission of allPending) {
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

        // 3. Fetch status from LHDN with automatic fallback
        let lhdnResult: any;
        let rawStatus: string | undefined;
        let documentErrors: any[] = [];
        let viaDoc = false;

        if (submission.submission_id) {
          try {
            // CORRECT ENDPOINT per docs: /api/v1.0/documentsubmissions/{id}
            lhdnResult = await lhdnGet(config, `/api/v1.0/documentsubmissions/${submission.submission_id}`, token)
            rawStatus = lhdnResult.overallStatus?.toLowerCase()
            documentErrors = lhdnResult.errors || []
            
            // Target the specific document in the submission if multiple exist
            if (lhdnResult.documentSummary?.length > 0) {
              const doc = lhdnResult.documentSummary.find((d: any) => d.uuid === submission.doc_uuid) || lhdnResult.documentSummary[0]
              rawStatus = doc.status?.toLowerCase()
              // For individual docs, use the internal errors if available
            }
          } catch (submissionErr: any) {
            console.warn(`Submission API failed for ${submission.submission_id}: ${submissionErr.message}`)
            // Fallback to Document Details API
            if (submission.doc_uuid) {
              viaDoc = true
              lhdnResult = await lhdnGet(config, `/api/v1.0/documents/${submission.doc_uuid}/details`, token)
              rawStatus = lhdnResult.status?.toLowerCase()
              documentErrors = lhdnResult.validationSteps?.flatMap((s: any) => s.error ? [s.error] : []) || []
            } else {
              throw submissionErr
            }
          }
        } else if (submission.doc_uuid) {
          viaDoc = true
          lhdnResult = await lhdnGet(config, `/api/v1.0/documents/${submission.doc_uuid}/details`, token)
          rawStatus = lhdnResult.status?.toLowerCase()
          documentErrors = lhdnResult.validationSteps?.flatMap((s: any) => s.error ? [s.error] : []) || []
        } else {
          continue
        }

        console.log(`Status for ${submission.doc_uuid}: ${rawStatus} (via ${viaDoc ? 'Document' : 'Submission'} API)`)

        // Map LHDN status values to our internal statuses
        // LHDN Values: valid, invalid, cancelled, rejected, submitted
        const newStatus = rawStatus === 'valid' ? 'validated' 
          : (rawStatus === 'invalid' || rawStatus === 'rejected') ? 'rejected' 
          : rawStatus

        // Skip if still in-progress
        if (!newStatus || ['submitted', 'in progress', 'pending'].includes(newStatus)) continue

        // 4. Update Records
        if (submission.table === 'einvoice_submissions') {
          await admin.from('einvoice_submissions').update({
            status:        newStatus, 
            lhdn_response: lhdnResult,
            error_codes:   documentErrors.map((e: any) => e.code || e).filter(Boolean),
            validated_at:  new Date().toISOString()
          }).eq('id', submission.id)
        }

        if (submission.doc_uuid) {
          await admin.from('einvoices').update({
            status:        newStatus,
            error_code:    documentErrors[0]?.code || null,
            error_message: documentErrors[0]?.message || null,
            validated_at:  new Date().toISOString(),
          }).eq('lhdn_uuid', submission.doc_uuid)
        }

        // 5. Automation: Sync order status if validated
        if (newStatus === 'validated' && submission.order_ids?.length === 1) {
           await admin.from('orders').update({
              einvoice_status: 'individual_issued'
           }).eq('id', submission.order_ids[0])
        }

      } catch (err: any) {
        console.error(`Poll failed for doc ${submission.doc_uuid || submission.submission_id}:`, err.message)
      }
    }

    return new Response(JSON.stringify({ success: true, polled: allPending.length }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('Polling function crash:', err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})

// ─── LHDN Helpers ──────────────────────────────────────────────────────────

function lhdnBase(env: string) {
  return env === 'production'
    ? 'https://api.myinvois.hasil.gov.my'
    : 'https://preprod-api.myinvois.hasil.gov.my'
}

async function getLhdnToken(config: any): Promise<string> {
  const r = await fetch(`${lhdnBase(config.env)}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     config.client_id,
      client_secret: config.client_secret,
      scope:         'InvoicingAPI',
    }),
  })
  if (!r.ok) {
    const b = await r.json().catch(() => ({})) as any
    throw new Error(`Token auth failed: ${b.error_description || r.status}`)
  }
  return (await r.json() as any).access_token
}

async function lhdnGet(config: any, path: string, token: string): Promise<any> {
  const r = await fetch(`${lhdnBase(config.env)}${path}`, {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  })
  if (!r.ok) throw new Error(`LHDN ${r.status} for ${path}`)
  return r.json()
}
