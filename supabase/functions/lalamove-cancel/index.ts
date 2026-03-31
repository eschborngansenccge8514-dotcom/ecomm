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

    // 1. Auth check: merchant ownership
    const authHeader = req.headers.get('Authorization')!
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, lalamove_order_id, merchant_id, lalamove_retry_count')
      .eq('id', orderId)
      .single()

    if (orderError || !order) throw new Error('Order not found')

    // Verify merchant owner
    const { data: merchant } = await supabase
      .from('merchants')
      .select('owner_id')
      .eq('id', order.merchant_id)
      .single()

    if (!merchant || merchant.owner_id !== user.id) {
      // Allow service role to also call this (for auto-cancellation logic later)
      // Check if it's the service role key or if user is authorized.
      // But for now, plan says check against auth user.
      throw new Error('Unauthorized merchant operation')
    }

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

    // On success (200), 404 (already cancelled), or 422 (specific rule)
    if (responseStatus === 200 || responseStatus === 404) {
      await supabase.from('orders').update({
        status: 'confirmed', // Plan says: Map CANCELLED → revert order status to confirmed
        lalamove_order_id: null,
        driver_name: null,
        driver_phone: null,
        driver_plate: null,
        lalamove_cancel_reason: reason ?? 'Cancelled by merchant'
      }).eq('id', orderId)

      await supabase.from('delivery_exception_logs').insert({
        order_id: order.id,
        type: 'cancelled',
        message: reason ?? 'Order cancelled by merchant',
        raw_payload: responseData
      })

      return new Response(JSON.stringify({ success: true, message: 'Lalamove order cancelled' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    if (responseStatus === 422) {
       return new Response(JSON.stringify({ 
         error: responseData?.message ?? 'Driver already picked up, cannot cancel' 
       }), {
        status: 200, // Return as success with error message for client handling
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
