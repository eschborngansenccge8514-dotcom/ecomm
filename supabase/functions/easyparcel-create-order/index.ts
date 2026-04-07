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
      .select('*, merchant:merchant_id(store_name, address_line1, city, state, postcode, phone), items:order_items(product_name, quantity)')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) throw new Error('Order not found')

    // ── Pre-booking Balance Check ──────────────────────────────────────────
    const { data: wallet } = await supabase
      .from('merchant_wallets')
      .select('balance')
      .eq('merchant_id', order.merchant_id)
      .single()

    if (!wallet || Number(wallet.balance) < 10) {
      throw new Error('Insufficient wallet balance. Please top up at least RM 10.00 to book deliveries.')
    }
    // ──────────────────────────────────────────────────────────────────────

    // Fetch per-merchant EasyParcel configuration
    const { data: epConfig } = await supabase
      .from('merchant_easyparcel_config')
      .select('*')
      .eq('merchant_id', order.merchant_id)
      .single()

    const epCallConfig = { 
      apiKey:      (epConfig?.is_enabled && epConfig?.api_key) ? epConfig.api_key : Deno.env.get('EASYPARCEL_API_KEY'), 
      authKey:     (epConfig?.is_enabled && (epConfig?.auth_key || epConfig?.api_secret)) ? (epConfig.auth_key || epConfig.api_secret) : Deno.env.get('EASYPARCEL_AUTH_KEY'),
      environment: (epConfig?.is_enabled && epConfig?.environment) ? epConfig.environment : (Deno.env.get('DELIVERY_ENV') || 'sandbox')
    }
    
    console.log(`[easyparcel-create-order] Using environment: ${epCallConfig.environment}, fallback: ${!epConfig?.api_key}`)

    if (!epCallConfig.apiKey || !epCallConfig.authKey) {
      throw new Error('EasyParcel integration is not fully configured (Missing API Key or Auth Key).')
    }

    const deliveryAddr = order.delivery_address as any

    // Phase 1 — Input & Service Selection
    if (!serviceId) {
      serviceId = order.delivery_service_id || epConfig?.preferred_courier
    }

    let selectedCourier: any = null
    const isStandardDelivery = serviceId === 'standard-delivery' || !serviceId

    // Always do a rate check — needed for auto-select AND to resolve courier name/price for explicit serviceId
    console.log(`[easyparcel-create-order] Fetching rates to resolve courier details...`)
    const rateData = await callEasyParcel(supabase, orderId, 'MPRateCheckingBulk', {
      bulk: [{
        pick_code:    epConfig?.sender_postcode || order.merchant?.postcode,
        pick_state:   epConfig?.sender_state || getStateCode(order.merchant?.state),
        pick_country: epConfig?.sender_country || 'MY',
        send_code:    deliveryAddr.postcode,
        send_state:   getStateCode(deliveryAddr.state),
        send_country: 'MY',
        weight:       String(Math.max(Number(weightKg || 0.5), 0.1).toFixed(1)),
      }],
      exclude_fields: [
        'rates.*.dropoff_point',
        'rates.*.pickup_point',
        'pgeon_point'
      ]
    }, epCallConfig)

    const rates = rateData?.result?.[0]?.rates || []

    if (isStandardDelivery || !serviceId || serviceId === 'auto') {
      // If we have no rates, we can't book via API
      if (rates.length === 0) {
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

      // Fallback if no matching rates found
      if (filteredRates.length === 0) {
        console.warn(`[easyparcel-create-order] No rates matching ${collectionType}. Showing all available as fallback.`)
        filteredRates = rates
      }

      // Auto-selecting cheapest:
      selectedCourier = filteredRates.sort((a: any, b: any) => parseFloat(a.price) - parseFloat(b.price))[0]
      serviceId = selectedCourier.service_id || selectedCourier.sid?.toString() || selectedCourier.courier_id
      console.log(`[easyparcel-create-order] Auto-selected cheapest: ${selectedCourier.courier_name} (${serviceId}) at RM${selectedCourier.price}`)
    } else {
      // Explicit serviceId: look it up in the rates to get name and price
      selectedCourier = rates.find((r: any) =>
        r.service_id === serviceId ||
        String(r.sid) === String(serviceId) ||
        r.courier_id === serviceId
      ) || null
      if (selectedCourier) {
        console.log(`[easyparcel-create-order] Resolved serviceId ${serviceId} → ${selectedCourier.courier_name} at RM${selectedCourier.price}`)
      } else {
        console.warn(`[easyparcel-create-order] Could not match serviceId ${serviceId} in rates; courier name/price will be approximate.`)
      }
    }

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
      bulk: [{
        weight:       String(Math.max(Number(weightKg), 0.1).toFixed(1)),
        width:        String(epConfig?.default_width_cm || 15),
        height:       String(epConfig?.default_height_cm || 10),
        length:       String(epConfig?.default_length_cm || 20),
        content:      order.items?.map((i: any) => i.product_name).join(', ').slice(0, 100) || `Order ${order.order_number}`,
        value:        String(order.total_amount),
        service_id:   serviceId,
        pick_name:    epConfig?.sender_name     || order.merchant?.store_name,
        pick_contact: epConfig?.sender_phone    || order.merchant?.phone?.replace(/\D/g, ''),
        pick_addr1:   epConfig?.sender_address1 || order.merchant?.address_line1,
        pick_addr2:   epConfig?.sender_address2 || '',
        pick_city:    epConfig?.sender_city     || order.merchant?.city,
        pick_state:   epConfig?.sender_state    || getStateCode(order.merchant?.state), 
        pick_code:    epConfig?.sender_postcode || order.merchant?.postcode,
        pick_country: epConfig?.sender_country  || 'MY',
        send_name:    deliveryAddr.name,
        send_contact: deliveryAddr.phone?.replace(/\D/g, ''),
        send_addr1:   deliveryAddr.line1,
        send_addr2:   deliveryAddr.line2 || '',
        send_city:    deliveryAddr.city,
        send_state:   getStateCode(deliveryAddr.state),
        send_code:    deliveryAddr.postcode,
        send_country: 'MY',
        collect_date: getCollectionDate(),
        collect_by:   epConfig?.collection_type || 'pickup',
        sms:          '0',
        send_email:   epConfig?.sender_email || 'noreply@hyperlocal.app',
        reference:    order.order_number,
      }]
    }, epCallConfig)

    const orderNo = submitData.result?.[0]?.order_number
    if (!orderNo) {
      const remark = submitData.result?.[0]?.remarks || 'Unknown EasyParcel error'
      throw new Error(`EasyParcel booking failed: ${remark}`)
    }

    // Step 2: Pay Order (MPPayOrderBulk)
    const payData = await callEasyParcel(supabase, orderId, 'MPPayOrderBulk', {
      bulk: [{ order_no: orderNo }]
    }, epCallConfig)

    const result      = payData.result?.[0]
    const messagenow  = result?.messagenow ?? ''
    const parcel      = result?.parcel?.[0]
    const awb         = parcel?.awb ?? ''
    const awbIdLink   = parcel?.awb_id_link ?? ''
    const trackingUrl = parcel?.tracking_url ?? ''
    const parcelNo    = parcel?.parcelno ?? ''
    const finalCourierName = selectedCourier?.courier_name || 'Courier'
    const finalShippingCost = parseFloat(selectedCourier?.price || '0') || 0

    console.log(`[easyparcel-create-order] Payment status: "${messagenow}", AWB: ${awb}, Parcel: ${parcelNo}`)

    // Phase 3 — Order Payment validation (case-insensitive comparison per API docs)
    const msgLower = messagenow.toLowerCase()
    const isSuccess = ['fully paid', 'payment done', 'already paid'].includes(msgLower)
    if (!isSuccess) {
      const isInsufficientCredit = msgLower.includes('insufficient')
      const errorMsg = isInsufficientCredit
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

    // Phase 3.5 — Wallet Deduction
    if (finalShippingCost > 0) {
      try {
        await supabase.rpc('deduct_shipping_wallet_balance', {
          p_merchant_id: order.merchant_id,
          p_amount:      finalShippingCost,
          p_order_id:    orderId,
          p_description: `EasyParcel booking for order ${order.order_number}`
        })
      } catch (deductErr: any) {
        console.error('[easyparcel-create-order] Wallet deduction failed:', deductErr.message)
      }
    }

    // Step 4: Create shipment record for dashboard tracking
    await supabase.from('easyparcel_shipments').upsert({
      merchant_id:      order.merchant_id,
      order_id:         orderId,
      ep_order_number:  orderNo,
      ep_parcel_number: parcel?.parcelno || null,
      awb:              awb || null,
      awb_id_link:      awbIdLink || null,
      tracking_url:     trackingUrl || null,
      courier_name:     finalCourierName,
      service_id:       serviceId,
      shipping_cost:    finalShippingCost,
      order_status:     messagenow,
      ship_status:      awb ? 'Pending' : 'Undefined Status',
      weight:           Number(weightKg),
      content:          order.items?.map((i: any) => i.product_name).join(', ').slice(0, 100) || `Order ${order.order_number}`,
      reference:        order.order_number,
      
      // Detailed address troubleshooting fields
      pick_name:        epConfig?.sender_name     || order.merchant?.store_name,
      pick_contact:     epConfig?.sender_phone    || order.merchant?.phone?.replace(/\D/g, ''),
      pick_addr1:       epConfig?.sender_address1 || order.merchant?.address_line1,
      pick_city:        epConfig?.sender_city     || order.merchant?.city,
      pick_state:       epConfig?.sender_state    || getStateCode(order.merchant?.state),
      pick_postcode:    epConfig?.sender_postcode || order.merchant?.postcode,
      
      send_name:        deliveryAddr.name,
      send_contact:     deliveryAddr.phone?.replace(/\D/g, ''),
      send_email:       epConfig?.sender_email || 'noreply@hyperlocal.app',
      send_addr1:       deliveryAddr.line1,
      send_city:        deliveryAddr.city,
      send_state:       getStateCode(deliveryAddr.state),
      send_postcode:    deliveryAddr.postcode,

      is_demo:          epCallConfig.environment === 'sandbox',
      updated_at:       new Date().toISOString()
    }, { onConflict: 'ep_order_number' })

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
      JSON.stringify({ 
        success: true, 
        orderNo,
        parcelNo,
        trackingNumber: awb, 
        trackingUrl: trackingUrl, 
        awbIdLink: awbIdLink,
        message: 'EasyParcel order created and paid successfully.' 
      }),
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

