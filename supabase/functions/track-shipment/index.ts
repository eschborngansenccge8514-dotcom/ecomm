import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { identifiers, id_type, merchant_id } = await req.json()
    if (!identifiers || !Array.isArray(identifiers)) throw new Error('identifiers array is required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const results = []

    for (const id of identifiers) {
      let query = supabase.from('orders').select('*').eq('merchant_id', merchant_id)
      
      if (id_type === 'tracking_number') {
        query = query.eq('tracking_number', id)
      } else {
        query = query.eq('id', id)
      }

      const { data: order } = await query.single()

      if (!order) {
        results.push({ identifier: id, error: 'Order not found' })
        continue
      }

      // Logic: If Lalamove, call lalamove-get-order-status
      if (order.delivery_provider === 'lalamove') {
        const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/lalamove-get-order-status`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ orderId: order.id })
        })
        const data = await res.json()
        results.push({ identifier: id, provider: 'lalamove', ...data })
      } 
      // If EasyParcel, call easyparcel-sync-status
      else if (order.delivery_provider === 'easyparcel') {
        const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/easyparcel-sync-status`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ orderId: order.id })
        })
        const data = await res.json()
        results.push({ identifier: id, provider: 'easyparcel', ...data })
      } else {
        results.push({ identifier: id, provider: 'none', status: order.status, delivery_status: order.delivery_status })
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
