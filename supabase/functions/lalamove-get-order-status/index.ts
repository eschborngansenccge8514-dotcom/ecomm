import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildLalamoveHeaders, getLalamoveBaseUrl } from '../_shared/lalamove-auth.ts'
import { retryWithBackoff, logLalamoveApi, mapLalamoveStatus } from '../_shared/utils.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { orderId } = await req.json()
    if (!orderId) throw new Error('orderId is required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, lalamove_order_id, status, delivery_status, customer_id')
      .eq('id', orderId)
      .single()

    if (orderError || !order) throw new Error('Order not found')
    if (!order.lalamove_order_id) throw new Error('Lalamove order ID missing')

    const apiKey = Deno.env.get('LALAMOVE_API_KEY')!
    const apiSecret = Deno.env.get('LALAMOVE_API_SECRET')!
    const baseUrl = getLalamoveBaseUrl()
    const path = `/v3/orders/${order.lalamove_order_id}`

    let responseData: any = null
    let responseStatus = 200

    await retryWithBackoff(async () => {
      const headers = await buildLalamoveHeaders(apiKey, apiSecret, 'GET', path)
      const res = await fetch(`${baseUrl}${path}`, { method: 'GET', headers })
      responseStatus = res.status
      responseData = await res.json()

      await logLalamoveApi(supabase, order.id, {
        endpoint: path,
        method: 'GET',
        statusCode: res.status,
        responseBody: responseData,
        attempt: 1
      })

      if (!res.ok) {
        throw new Error(responseData?.message ?? 'Lalamove GET failed')
      }
    })

    if (responseStatus === 200) {
      const lalamoveData = responseData.data
      const lalamoveStatus = lalamoveData.status
      
      const { updates, callLoyalty } = mapLalamoveStatus(lalamoveStatus, lalamoveData)
      
      let changed = false
      // Check if status changed
      if (updates.status && updates.status !== order.status) changed = true
      if (updates.delivery_status && updates.delivery_status !== order.delivery_status) changed = true

      if (Object.keys(updates).length > 1) {
        await supabase.from('orders').update(updates).eq('id', orderId)
        
        // Log sync event
        await supabase.from('delivery_events').insert({
          order_id: order.id,
          provider: 'lalamove',
          event_type: 'poll_sync',
          raw_payload: lalamoveData
        })
      }

      // Handle side effects
      if (callLoyalty && changed) {
         await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/award-loyalty-points`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({ orderId: order.id })
        }).catch(console.error)
      }

      return new Response(JSON.stringify({ 
        success: true, 
        status: updates.status || order.status,
        deliveryStatus: updates.delivery_status || order.delivery_status,
        changed,
        driverInfo: lalamoveData.driverInfo
      }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    throw new Error('Unexpected response from Lalamove')

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
