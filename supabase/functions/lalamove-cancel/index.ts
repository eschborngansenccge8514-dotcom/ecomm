import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildLalamoveHeaders, getLalamoveBaseUrl } from '../_shared/lalamove-auth.ts'
import { retryWithBackoff, logLalamoveApi } from '../_shared/utils.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { orderId, reason } = await req.json()
    if (!orderId) throw new Error('orderId is required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, lalamove_order_id, merchant_id, lalamove_retry_count')
      .eq('id', orderId)
      .single()

    if (orderError || !order) throw new Error('Order not found')

    if (!order.lalamove_order_id) throw new Error('No Lalamove order to cancel')

    const apiKey = Deno.env.get('LALAMOVE_API_KEY')!
    const apiSecret = Deno.env.get('LALAMOVE_API_SECRET')!
    const baseUrl = getLalamoveBaseUrl()
    const path = `/v3/orders/${order.lalamove_order_id}`

    let responseData: any = null
    let responseStatus = 200
    let lastError: any = null

    // Call Lalamove DELETE with retry logic
    try {
      await retryWithBackoff(async () => {
        const headers = await buildLalamoveHeaders(apiKey, apiSecret, 'DELETE', path)
        const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE', headers })
        responseStatus = res.status
        responseData = await res.json()

        // Log the API call
        await logLalamoveApi(supabase, order.id, {
          endpoint: path,
          method: 'DELETE',
          statusCode: res.status,
          responseBody: responseData,
          attempt: 1 // For simplified log, retry utility could be improved to pass attempt
        })

        if (!res.ok) {
          if (res.status === 404 || res.status === 422) {
            // Do not retry on 404 or 422
            return 
          }
          throw new Error(responseData?.message ?? 'Lalamove cancel failed')
        }
      })
    } catch (e) {
      lastError = e
    }

    // On success (200), 404 (already cancelled)
    if (responseStatus === 200 || responseStatus === 404) {
      await supabase.from('orders').update({
        delivery_status: 'cancelled',
        lalamove_order_id: null,
        driver_name: null,
        driver_phone: null,
        driver_plate: null,
      }).eq('id', orderId)

      await supabase.from('delivery_events').insert({
        order_id: order.id,
        provider: 'lalamove',
        event_type: 'order_cancelled',
        raw_payload: { reason: reason ?? 'Cancelled by merchant', response: responseData }
      })

      return new Response(JSON.stringify({ success: true, message: 'Lalamove order cancelled' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    if (responseStatus === 422) {
      return new Response(JSON.stringify({ 
        error: responseData?.message ?? 'ERR_CANCELLATION_FORBIDDEN: Driver already en route, cannot cancel' 
      }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    throw lastError || new Error('Lalamove unavailable, try again')

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
