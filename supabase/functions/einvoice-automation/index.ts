import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const { orderId, posRequestId } = payload

    console.log(`[Automation] Delegating to Worker — orderId: ${orderId}, posRequestId: ${posRequestId}`)

    // Use the Cloudflare Worker URL from environment or fallback
    const WORKER_URL = Deno.env.get('WORKER_URL') || 'https://functions-worker.jjooi1707.workers.dev'
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    const response = await fetch(`${WORKER_URL}/einvoice/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        order_id: orderId,
        posRequestId: posRequestId
      })
    })

    const result = await response.json()
    
    if (!response.ok) {
      console.error('[Automation Error] Worker returned:', JSON.stringify(result))
      throw new Error(result.message || result.error || 'Worker submission failed')
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('[Automation Error]', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
