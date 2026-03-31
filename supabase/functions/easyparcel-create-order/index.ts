import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callEasyParcel, getStateCode, getCollectionDate } from '../_shared/easyparcel.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json().catch(() => ({}))
    const { orderId } = body
    let { serviceId, weightKg } = body
    
    console.log(`--- [easyparcel-create-order] Invocated for order: ${orderId} ---`)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (!orderId) throw new Error('orderId is required')

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, merchant:merchant_id(store_name, address_line1, city, state, postcode, phone)')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) throw new Error('Order not found')

    // Fetch per-merchant EasyParcel configuration
    const { data: epConfig } = await supabase
      .from('merchant_easyparcel_config')
      .select('*')
      .eq('merchant_id', order.merchant_id)
      .single()

    const epCallConfig = { 
      apiKey:      epConfig?.api_key || Deno.env.get('EASYPARCEL_API_KEY'), 
      environment: epConfig?.environment || 'sandbox' 
    }
    
    console.log(`[easyparcel-create-order] Using environment: ${epCallConfig.environment}, fallback: ${!epConfig?.api_key}`)

    if (!epCallConfig.apiKey || !Deno.env.get('EASYPARCEL_AUTH_KEY')) {
      throw new Error('EasyParcel integration is not fully configured (Missing API Key or Auth Key).')
    }

    const deliveryAddr = order.delivery_address as any

    // Phase 1 — Input & Service Selection
    if (!serviceId) {
      serviceId = order.delivery_service_id || epConfig?.preferred_courier
    }

    // Always check rates if we don't have a confirmed serviceId or if we need to validate it
    console.log(`[easyparcel-create-order] Checking available rates for route...`)
    const rateData = await callEasyParcel(supabase, orderId, 'MPRateCheckingBulk', {
      'bulk[0][pick_code]':    epConfig?.sender_postcode || order.merchant?.postcode,
      'bulk[0][pick_state]':   epConfig?.sender_state || getStateCode(order.merchant?.state),
      'bulk[0][pick_country]': epConfig?.sender_country || 'MY',
      'bulk[0][send_code]':    deliveryAddr.postcode,
      'bulk[0][send_state]':   getStateCode(deliveryAddr.state),
      'bulk[0][send_country]': 'MY',
      'bulk[0][weight]':       String(Math.max(Number(weightKg || 0.5), 0.1).toFixed(1)),
    }, epCallConfig)

    const rates = rateData?.result?.[0]?.rates || []
    
    // If we have no rates, we can't book via API, but let's check if it's a standard-delivery request
    if (rates.length === 0 && serviceId !== 'standard-delivery') {
      throw new Error('EasyParcel: No available couriers found for this route/weight. You may need to book this parcel manually.')
    }

    const collectionType = epConfig?.collection_type || 'pickup'
    console.log(`[easyparcel-create-order] Merchant collection type is ${collectionType}. Filtering rates...`)

    // Filter rates to only show compatible services
    let filteredRates = rates.filter((r: any) => 
      r.service_detail === collectionType || 
      (collectionType === 'pickup' && r.service_detail === 'pickup') ||
      (collectionType === 'dropoff' && r.service_detail === 'dropoff')
    )

    // Fallback if no matching rates found (e.g. only dropoff available but merchant wants pickup)
    if (filteredRates.length === 0) {
      console.warn(`[easyparcel-create-order] No rates matching ${collectionType}. Showing all available as fallback.`)
      filteredRates = rates
    }

    let selectedCourier: any = null
    const isStandardDelivery = serviceId === 'standard-delivery' || !serviceId

    if (rates.length === 0 && isStandardDelivery) {
      throw new Error('EasyParcel: Failed to find a compatible service even for Standard Delivery. Please check if the destination postcode is valid.')
    }

    if (serviceId && !isStandardDelivery) {
      // Try to find the specific courier requested among compatible ones first
      selectedCourier = filteredRates.find((r: any) => 
        r.service_id === serviceId || 
        r.sid?.toString() === serviceId?.toString() ||
        r.courier_id === serviceId
      )
    }

    if (!selectedCourier) {
      // Fallback to cheapest available in the compatible set (or used if standard-delivery)
      selectedCourier = filteredRates.sort((a: any, b: any) => parseFloat(a.price) - parseFloat(b.price))[0]
      const reason = isStandardDelivery ? "Standard Delivery requested" : `Requested service ${serviceId} not available or incompatible`;
      console.log(`[easyparcel-create-order] ${reason}. Auto-selecting cheapest: ${selectedCourier.courier_name}`)
    }

    serviceId = selectedCourier.service_id || selectedCourier.sid?.toString() || selectedCourier.courier_id
    console.log(`[easyparcel-create-order] Selected courier: ${selectedCourier.courier_name} (${serviceId}) at RM${selectedCourier.price} [${selectedCourier.service_detail}]`)

    if (!weightKg || isNaN(Number(weightKg)) || Number(weightKg) <= 0) {
      const { data: items } = await supabase
        .from('order_items')
        .select('quantity, products(weight_grams)')
        .eq('order_id', orderId)
      
      let totalGrams = 0
      items?.forEach((item: any) => {
        // Fallback to merchant default if weight_grams is not set
        const grams = item.products?.weight_grams || ((epConfig?.default_weight_kg || 0.5) * 1000)
        totalGrams += grams * item.quantity
      })
      
      weightKg = totalGrams > 0 ? totalGrams / 1000 : (epConfig?.default_weight_kg || 0.5)
      console.log(`[easyparcel-create-order] Calculated weight: ${weightKg}kg for order ${orderId}`)
    }

    // Step 1: Make Order (MPSubmitOrderBulk)
    const submitData = await callEasyParcel(supabase, orderId, 'MPSubmitOrderBulk', {
      'bulk[0][weight]':       String(Math.max(Number(weightKg), 0.1).toFixed(1)),
      'bulk[0][width]':        String(epConfig?.default_width_cm || 15),
      'bulk[0][height]':       String(epConfig?.default_height_cm || 10),
      'bulk[0][length]':       String(epConfig?.default_length_cm || 20),
      'bulk[0][content]':      order.items?.map((i: any) => i.product_name).join(', ').slice(0, 100) || `Order ${order.order_number}`,
      'bulk[0][value]':        String(order.total_amount),
      'bulk[0][service_id]':   serviceId,
      'bulk[0][pick_name]':    epConfig?.sender_name     || order.merchant?.store_name,
      'bulk[0][pick_contact]': epConfig?.sender_phone    || order.merchant?.phone?.replace(/\D/g, ''),
      'bulk[0][pick_addr1]':   epConfig?.sender_address1 || order.merchant?.address_line1,
      'bulk[0][pick_addr2]':   epConfig?.sender_address2 || '',
      'bulk[0][pick_city]':    epConfig?.sender_city     || order.merchant?.city,
      'bulk[0][pick_state]':   epConfig?.sender_state    || getStateCode(order.merchant?.state), 
      'bulk[0][pick_code]':    epConfig?.sender_postcode || order.merchant?.postcode,
      'bulk[0][pick_country]': epConfig?.sender_country  || 'MY',
      'bulk[0][send_name]':    deliveryAddr.name,
      'bulk[0][send_contact]': deliveryAddr.phone?.replace(/\D/g, ''),
      'bulk[0][send_addr1]':   deliveryAddr.line1,
      'bulk[0][send_addr2]':   deliveryAddr.line2 || '',
      'bulk[0][send_city]':    deliveryAddr.city,
      'bulk[0][send_state]':   getStateCode(deliveryAddr.state),
      'bulk[0][send_code]':    deliveryAddr.postcode,
      'bulk[0][send_country]': 'MY',
      'bulk[0][collect_date]': getCollectionDate(),
      'bulk[0][collect_by]':   epConfig?.collection_type || 'pickup',
      'bulk[0][sms]':          '0',
      'bulk[0][send_email]':   epConfig?.sender_email || 'noreply@hyperlocal.app',
      'bulk[0][reference]':    order.order_number,
    }, epCallConfig)

    const orderNo = submitData.result?.[0]?.order_number
    if (!orderNo) {
      const remark = submitData.result?.[0]?.remarks || 'Unknown EasyParcel error'
      throw new Error(`EasyParcel booking failed: ${remark}`)
    }

    // Step 2: Pay Order (MPPayOrderBulk)
    const payData = await callEasyParcel(supabase, orderId, 'MPPayOrderBulk', {
      'bulk[0][order_no]': orderNo
    }, epCallConfig)

    const result      = payData.result?.[0]
    const messagenow  = result?.messagenow
    const parcel      = result?.parcel?.[0]
    const awb         = parcel?.awb ?? ''
    const trackingUrl = parcel?.tracking_url ?? ''

    // Phase 3 — Order Payment validation
    const successStatuses = ['Fully Paid', 'Payment Done', 'Already Paid']
    if (!successStatuses.includes(messagenow)) {
      const errorMsg = messagenow === 'Insufficient Credit' 
        ? 'Seller EasyParcel wallet balance is insufficient. Please top up your EasyParcel wallet.' 
        : `EasyParcel Payment Status: ${messagenow}`
      
      // Update order with payment failure details but keep order_no
      await supabase.from('orders').update({
        easyparcel_order_no:  orderNo,
        exception_flag:       'api_failure',
        merchant_note:        `EasyParcel Payment Error: ${messagenow}`,
        delivery_status:      'failed'
      }).eq('id', orderId)

      // Log exception
      await supabase.from('delivery_exception_logs').insert({
        order_id: orderId,
        type: 'easyparcel_payment_fail',
        message: errorMsg,
        raw_payload: payData
      })

      throw new Error(errorMsg)
    }

    // Step 3: Check AWB
    if (!awb) {
      console.warn(`AWB not ready for order ${orderNo}`)
    }

    // Update our order with success details
    await supabase.from('orders').update({
      status:               'confirmed',
      delivery_provider:    'easyparcel',
      delivery_type:        'courier',
      delivery_service_id:  serviceId,
      easyparcel_order_no:  orderNo,
      tracking_number:      awb,
      tracking_url:         trackingUrl,
      delivery_status:      awb ? 'pending' : 'not_requested'
    }).eq('id', orderId)

    await supabase.from('delivery_events').insert({
      order_id:    orderId,
      provider:    'easyparcel',
      event_type:  'order_created',
      raw_payload: { submitData, payData },
    })

    return new Response(
      JSON.stringify({ success: true, orderNo, awb, trackingUrl, message: 'EasyParcel order created and paid successfully.' }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('[easyparcel-create-order] Error:', err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})

