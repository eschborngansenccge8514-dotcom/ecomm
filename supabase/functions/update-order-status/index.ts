import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { order_id, new_status, note, merchant_id } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check if order belongs to merchant
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', order_id)
      .eq('merchant_id', merchant_id)
      .single()

    if (error || !order) throw new Error('Order not found or unauthorized')

    // Update status and internal note
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        status:     new_status, 
        internal_note: note || undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id)

    if (updateError) throw updateError

    // Log the event
    await supabase.from('delivery_events').insert({
      order_id,
      event_type: 'status_update',
      provider:   'merchant',
      raw_payload: { old_status: order.status, new_status, note }
    })

    return new Response(JSON.stringify({ success: true, status: new_status }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
