import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callEasyParcel, getStateCode } from '../_shared/easyparcel.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { orderId } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: order } = await supabase
      .from('orders')
      .select(`
        *,
        merchant:merchant_id(address_line1, city, state, postcode),
        items:order_items(quantity, product:product_id(weight_grams))
      `)
      .eq('id', orderId)
      .single()

    if (!order) throw new Error('Order not found')

    const deliveryAddr = order.delivery_address as any
    const merchant     = order.merchant as any

    // Calculate total weight from order items
    const totalWeightGrams = (order.items ?? []).reduce((sum: number, item: any) => {
      const itemWeight = (item.product?.weight_grams ?? 500) * (item.quantity ?? 1)
      return sum + itemWeight
    }, 0)
    const totalWeightKg = Math.max(totalWeightGrams / 1000, 0.1)

    // Fetch per-merchant EasyParcel configuration
    const { data: epConfig } = await supabase
      .from('merchant_easyparcel_config')
      .select('*')
      .eq('merchant_id', order.merchant_id)
      .single()

    const epCallConfig = { 
      apiKey:      epConfig?.api_key || Deno.env.get('EASYPARCEL_API_KEY'), 
      authKey:     epConfig?.auth_key || Deno.env.get('EASYPARCEL_AUTH_KEY'),
      environment: epConfig?.environment || 'sandbox' 
    }

    // Call EasyParcel using shared utility
    const epData = await callEasyParcel(supabase, orderId, 'MPRateCheckingBulk', {
      bulk: [{
        pick_code:    merchant.postcode,
        pick_state:   getStateCode(merchant.state),
        pick_country: 'MY',
        send_code:    deliveryAddr.postcode,
        send_state:   getStateCode(deliveryAddr.state),
        send_country: 'MY',
        weight:       String(totalWeightKg),
        parcel_value: String(order.total_amount),
      }],
      exclude_fields: [
        'rates.*.dropoff_point',
        'rates.*.pickup_point',
        'pgeon_point'
      ]
    }, epCallConfig)

    const rates = epData.result?.[0]?.rates ?? []
    
    // Edge Case: Empty rates
    if (rates.length === 0) {
      // Check if there was an error in the individual result
      const remark = epData.result?.[0]?.error_remark || epData.result?.[0]?.remarks
      if (remark) throw new Error(`EasyParcel: ${remark}`)
      
      return new Response(
        JSON.stringify({ 
          rates: [], 
          weightKg: totalWeightKg,
          error: "No courier available for this delivery route. Rural postcodes may require self-arrange pickup." 
        }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // Return top 6 cheapest rates with clean shape
    const cleanRates = rates
      .slice(0, 6)
      .map((r: any) => ({
        rateId:       r.rate_id,
        serviceId:    r.service_id,
        courierId:    r.courier_id,
        courierName:  r.courier_name,
        courierLogo:  r.courier_logo,
        serviceName:  r.service_name,
        serviceDetail:r.service_detail,
        price:        Number(r.price),
        delivery:     r.delivery,
        pickupDate:   r.pickup_date,
        weightKg:     totalWeightKg,
      }))

    return new Response(
      JSON.stringify({ rates: cleanRates, weightKg: totalWeightKg }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('[easyparcel-rate-check] Error:', err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
