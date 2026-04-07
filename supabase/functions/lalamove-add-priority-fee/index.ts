import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildLalamoveHeaders, getLalamoveBaseUrl } from '../_shared/lalamove-auth.ts'
import { logLalamoveApi } from '../_shared/utils.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { orderId, tipAmount } = await req.json()
    if (!orderId || !tipAmount) throw new Error('orderId and tipAmount are required')

    const tipAmountNum = parseFloat(tipAmount)
    if (isNaN(tipAmountNum) || tipAmountNum < 1 || tipAmountNum > 50) {
      throw new Error('Tip amount must be between RM 1 and RM 50')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, lalamove_order_id, priority_fee_added, merchant_id')
      .eq('id', orderId)
      .single()

    if (orderError || !order) throw new Error('Order not found')
    if (!order.lalamove_order_id) throw new Error('Lalamove order ID missing — delivery may not have been booked yet')

    const { data: llConfig } = await supabase
      .from('merchant_lalamove_config')
      .select('*')
      .eq('merchant_id', order.merchant_id)
      .maybeSingle()

    const apiKey    = (llConfig?.is_enabled && llConfig?.api_key) ? llConfig.api_key : Deno.env.get('LALAMOVE_API_KEY')!
    const apiSecret = (llConfig?.is_enabled && llConfig?.api_secret) ? llConfig.api_secret : Deno.env.get('LALAMOVE_API_SECRET')!
    const market    = llConfig?.market || Deno.env.get('LALAMOVE_MARKET') || 'MY'
    const env       = (llConfig?.is_enabled && llConfig?.environment) ? llConfig.environment : (Deno.env.get('DELIVERY_ENV') || 'sandbox')
    const baseUrl   = getLalamoveBaseUrl(env)

    // Correct Lalamove API: POST /v3/orders/{lalamoveOrderId}/priority-fee
    const path = `/v3/orders/${order.lalamove_order_id}/priority-fee`

    const body = JSON.stringify({
      data: {
        priorityFee: tipAmountNum.toFixed(2)
      }
    })

    const headers = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', path, body, market)
    const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body })
    const responseData = await res.json()

    await logLalamoveApi(supabase, order.id, {
      endpoint: path,
      method: 'POST',
      statusCode: res.status,
      requestBody: body,
      responseBody: responseData,
      attempt: 1
    })

    if (!res.ok) {
      const msg = responseData?.message ?? responseData?.error?.message ?? `Priority fee failed (${res.status})`
      throw new Error(msg)
    }

    const newPriorityFee = (parseFloat(order.priority_fee_added as any) || 0) + tipAmountNum
    await supabase.from('orders').update({
      priority_fee_added: newPriorityFee
    }).eq('id', orderId)

    await supabase.from('delivery_exception_logs').insert({
      order_id: order.id,
      type: 'priority_fee_added',
      message: `Added RM ${tipAmountNum.toFixed(2)} priority fee`,
      raw_payload: responseData
    })

    return new Response(JSON.stringify({ 
      success: true, 
      priorityFeeAdded: tipAmountNum,
      totalPriorityFee: newPriorityFee
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
