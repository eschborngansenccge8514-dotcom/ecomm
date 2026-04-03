import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EDGE_FUNCTION_MAP: Record<string, string> = {
  // Phase 1 & 2
  cancel_order:                  'cancel-order',
  create_lalamove_booking:       'create-lalamove-booking',
  create_easyparcel_shipment:    'create-easyparcel-shipment',
  cancel_shipment:               'cancel-shipment',
  bulk_mark_ready:               'bulk-mark-ready',

  // Phase 3
  bulk_price_update:             'bulk-price-update',
  process_refund:                'process-refund',

  // Phase 4
  batch_submit_invoices:         'batch-submit-invoices',
  generate_consolidated_invoice: 'generate-consolidated-invoice',
  process_point_redemption:      'process-point-redemption'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, jwt!)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401, headers: CORS })

  const { approval_id, action, reject_reason }
    : { approval_id: string, action: 'approve' | 'reject', reject_reason?: string } = await req.json()

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Fetch approval record
  const { data: approval, error: aErr } = await admin
    .from('agent_approvals')
    .select('*, agent_actions(session_id)')
    .eq('id', approval_id)
    .eq('merchant_id', user.id)
    .eq('status', 'pending')
    .single()

  if (aErr || !approval) return new Response(JSON.stringify({ error: 'Approval not found or already resolved' }), { status: 404, headers: CORS })

  if (action === 'reject') {
    await admin.from('agent_approvals').update({
      status: 'rejected', 
      approved_by: user.id,
      reject_reason, 
      resolved_at: new Date().toISOString()
    }).eq('id', approval_id)
    
    await admin.from('agent_actions').update({ status: 'rejected' }).eq('id', approval.action_id)
    
    return new Response(JSON.stringify({ status: 'rejected' }), { headers: CORS })
  }

  // Execute the deferred tool call
  const targetFn = EDGE_FUNCTION_MAP[approval.tool_name]
  if (!targetFn) return new Response(JSON.stringify({ error: `No function mapped for ${approval.tool_name}` }), { status: 400, headers: CORS })

  console.log(`Executing ${targetFn} for approval ${approval_id}...`)

  const execRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/${targetFn}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify({ ...approval.tool_input, merchant_id: user.id })
  })

  if (!execRes.ok) {
    const errorText = await execRes.text()
    await admin.from('agent_actions').update({ status: 'failed', output: { error: errorText } }).eq('id', approval.action_id)
    return new Response(JSON.stringify({ error: errorText }), { status: 500, headers: CORS })
  }

  const result = await execRes.json()
  
  await admin.from('agent_approvals').update({
    status: 'approved', 
    approved_by: user.id,
    resolved_at: new Date().toISOString()
  }).eq('id', approval_id)
  
  await admin.from('agent_actions').update({ 
    status: 'approved', 
    output: result 
  }).eq('id', approval.action_id)

  return new Response(JSON.stringify({ status: 'approved', result }), { headers: CORS })
})
