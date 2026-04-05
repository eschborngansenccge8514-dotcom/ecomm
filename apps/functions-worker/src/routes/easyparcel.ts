import { Hono } from 'hono'
import { getSupabaseClient, Bindings } from '../lib/supabase'
import { callEasyParcel, getStateCode, getCollectionDate } from '../lib/easyparcel'

const easyparcel = new Hono<{ Bindings: Bindings }>()

easyparcel.post('/rate-check', async (c) => {
  try {
    const { orderId } = await c.req.json()
    const supabase = getSupabaseClient(c.env)

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
    const merchant = order.merchant as any

    const totalWeightGrams = (order.items ?? []).reduce((sum: number, item: any) => {
      const itemWeight = (item.product?.weight_grams ?? 500) * (item.quantity ?? 1)
      return sum + itemWeight
    }, 0)
    const totalWeightKg = Math.max(totalWeightGrams / 1000, 0.1)

    const { data: epConfig } = await supabase
      .from('merchant_easyparcel_config')
      .select('*')
      .eq('merchant_id', order.merchant_id)
      .maybeSingle()

    const epCallConfig = { 
      apiKey: epConfig?.api_key || c.env.EASYPARCEL_API_KEY, 
      authKey: epConfig?.auth_key || c.env.EASYPARCEL_AUTH_KEY,
      environment: epConfig?.environment || 'sandbox' 
    }

    const epData = await callEasyParcel(supabase, orderId, 'MPRateCheckingBulk', {
      bulk: [{
        pick_code: merchant.postcode,
        pick_state: getStateCode(merchant.state),
        pick_country: 'MY',
        send_code: deliveryAddr.postcode,
        send_state: getStateCode(deliveryAddr.state),
        send_country: 'MY',
        weight: String(totalWeightKg),
        parcel_value: String(order.total_amount),
      }],
      exclude_fields: [
        'rates.*.dropoff_point',
        'rates.*.pickup_point',
        'pgeon_point'
      ]
    }, epCallConfig)

    const rates = epData.result?.[0]?.rates ?? []
    
    if (rates.length === 0) {
      const remark = epData.result?.[0]?.error_remark || epData.result?.[0]?.remarks
      if (remark) throw new Error(`EasyParcel: ${remark}`)
      
      return c.json({ 
        rates: [], 
        weightKg: totalWeightKg,
        error: "No courier available for this delivery route." 
      })
    }

    const cleanRates = rates
      .slice(0, 6)
      .map((r: any) => ({
        rateId: r.rate_id,
        serviceId: r.service_id,
        courierId: r.courier_id,
        courierName: r.courier_name,
        courierLogo: r.courier_logo,
        serviceName: r.service_name,
        serviceDetail: r.service_detail,
        price: Number(r.price),
        delivery: r.delivery,
        pickupDate: r.pickup_date,
        weightKg: totalWeightKg,
      }))

    return c.json({ rates: cleanRates, weightKg: totalWeightKg })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

easyparcel.post('/create-order', async (c) => {
  try {
    const { orderId, serviceId: overrideServiceId, weightKg: overrideWeightKg } = await c.req.json()
    let serviceId = overrideServiceId
    let weightKg = overrideWeightKg

    const supabase = getSupabaseClient(c.env)
    if (!orderId) throw new Error('orderId is required')

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, merchant:merchant_id(store_name, address_line1, city, state, postcode, phone), items:order_items(product_name, quantity)')
      .eq('id', orderId)
      .single()

    if (orderErr || !order) throw new Error('Order not found')

    const { data: epConfig } = await supabase
      .from('merchant_easyparcel_config')
      .select('*')
      .eq('merchant_id', order.merchant_id)
      .maybeSingle()

    const epCallConfig = { 
      apiKey: epConfig?.api_key || c.env.EASYPARCEL_API_KEY, 
      authKey: epConfig?.auth_key || c.env.EASYPARCEL_AUTH_KEY,
      environment: epConfig?.environment || 'sandbox' 
    }

    if (!epCallConfig.apiKey || !epCallConfig.authKey) {
      throw new Error('EasyParcel integration is not fully configured.')
    }

    const deliveryAddr = order.delivery_address as any
    if (!serviceId) {
      serviceId = order.delivery_service_id || epConfig?.preferred_courier
    }

    const isStandardDelivery = serviceId === 'standard-delivery' || !serviceId

    const rateData = await callEasyParcel(supabase, orderId, 'MPRateCheckingBulk', {
      bulk: [{
        pick_code: epConfig?.sender_postcode || order.merchant?.postcode,
        pick_state: epConfig?.sender_state || getStateCode(order.merchant?.state),
        pick_country: epConfig?.sender_country || 'MY',
        send_code: deliveryAddr.postcode,
        send_state: getStateCode(deliveryAddr.state),
        send_country: 'MY',
        weight: String(Math.max(Number(weightKg || 0.5), 0.1).toFixed(1)),
      }],
      exclude_fields: ['rates.*.dropoff_point', 'rates.*.pickup_point', 'pgeon_point']
    }, epCallConfig)

    const rates = rateData?.result?.[0]?.rates || []
    let selectedCourier: any = null

    if (isStandardDelivery || !serviceId || serviceId === 'auto') {
      if (rates.length === 0) throw new Error('EasyParcel: No available couriers found.')
      const collectionType = epConfig?.collection_type || 'pickup'
      let filteredRates = rates.filter((r: any) => r.service_detail === collectionType)
      if (filteredRates.length === 0) filteredRates = rates
      selectedCourier = filteredRates.sort((a: any, b: any) => parseFloat(a.price) - parseFloat(b.price))[0]
      serviceId = selectedCourier.service_id || selectedCourier.sid?.toString() || selectedCourier.courier_id
    } else {
      selectedCourier = rates.find((r: any) => r.service_id === serviceId || String(r.sid) === String(serviceId) || r.courier_id === serviceId) || null
    }

    if (!weightKg) {
      const { data: items } = await supabase.from('order_items').select('quantity, products(weight_grams)').eq('order_id', orderId)
      let totalGrams = 0
      items?.forEach((item: any) => {
        const grams = (item.products as any)?.weight_grams || ((epConfig?.default_weight_kg || 0.5) * 1000)
        totalGrams += grams * item.quantity
      })
      weightKg = totalGrams > 0 ? totalGrams / 1000 : (epConfig?.default_weight_kg || 0.5)
    }

    const submitData = await callEasyParcel(supabase, orderId, 'MPSubmitOrderBulk', {
      bulk: [{
        weight: String(Math.max(Number(weightKg), 0.1).toFixed(1)),
        width: String(epConfig?.default_width_cm || 15),
        height: String(epConfig?.default_height_cm || 10),
        length: String(epConfig?.default_length_cm || 20),
        content: order.items?.map((i: any) => i.product_name).join(', ').slice(0, 100) || `Order ${order.order_number}`,
        value: String(order.total_amount),
        service_id: serviceId,
        pick_name: epConfig?.sender_name || order.merchant?.store_name,
        pick_contact: epConfig?.sender_phone || order.merchant?.phone?.replace(/\D/g, ''),
        pick_addr1: epConfig?.sender_address1 || order.merchant?.address_line1,
        pick_addr2: epConfig?.sender_address2 || '',
        pick_city: epConfig?.sender_city || order.merchant?.city,
        pick_state: epConfig?.sender_state || getStateCode(order.merchant?.state), 
        pick_code: epConfig?.sender_postcode || order.merchant?.postcode,
        pick_country: epConfig?.sender_country || 'MY',
        send_name: deliveryAddr.name,
        send_contact: deliveryAddr.phone?.replace(/\D/g, ''),
        send_addr1: deliveryAddr.line1,
        send_addr2: deliveryAddr.line2 || '',
        send_city: deliveryAddr.city,
        send_state: getStateCode(deliveryAddr.state),
        send_code: deliveryAddr.postcode,
        send_country: 'MY',
        collect_date: getCollectionDate(),
        collect_by: epConfig?.collection_type || 'pickup',
        sms: '0',
        send_email: epConfig?.sender_email || 'noreply@hyperlocal.app',
        reference: order.order_number,
      }]
    }, epCallConfig)

    const orderNo = submitData.result?.[0]?.order_number
    if (!orderNo) throw new Error(`EasyParcel booking failed: ${submitData.result?.[0]?.remarks || 'Unknown error'}`)

    const payData = await callEasyParcel(supabase, orderId, 'MPPayOrderBulk', {
      bulk: [{ order_no: orderNo }]
    }, epCallConfig)

    const result = payData.result?.[0]
    const messagenow = result?.messagenow ?? ''
    const parcel = result?.parcel?.[0]
    const msgLower = messagenow.toLowerCase()
    const isSuccess = ['fully paid', 'payment done', 'already paid'].includes(msgLower)

    if (!isSuccess) throw new Error(`EasyParcel Payment Status: ${messagenow}`)

    await supabase.from('easyparcel_shipments').upsert({
      merchant_id: order.merchant_id,
      order_id: orderId,
      ep_order_number: orderNo,
      ep_parcel_number: parcel?.parcelno || null,
      awb: parcel?.awb || null,
      awb_id_link: parcel?.awb_id_link || null,
      tracking_url: parcel?.tracking_url || null,
      courier_name: selectedCourier?.courier_name || 'Courier',
      service_id: serviceId,
      shipping_cost: parseFloat(selectedCourier?.price || '0') || 0,
      order_status: messagenow,
      ship_status: parcel?.awb ? 'Pending' : 'Undefined Status',
      updated_at: new Date().toISOString()
    }, { onConflict: 'ep_order_number' })

    await supabase.from('orders').update({
      status: 'confirmed',
      delivery_provider: 'easyparcel',
      delivery_type: 'courier',
      delivery_service_id: serviceId,
      easyparcel_order_no: orderNo,
      tracking_number: parcel?.awb,
      tracking_url: parcel?.tracking_url,
      delivery_status: parcel?.awb ? 'pending' : 'not_requested'
    }).eq('id', orderId)

    return c.json({ success: true, orderNo, trackingNumber: parcel?.awb })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

easyparcel.post('/sync-status', async (c) => {
  try {
    const { order_id } = await c.req.json()
    const supabase = getSupabaseClient(c.env)
    
    const { data: shipment } = await supabase
      .from('easyparcel_shipments')
      .select('*')
      .eq('order_id', order_id)
      .single()

    if (!shipment) throw new Error('Shipment record not found')

    const { data: epConfig } = await supabase
      .from('merchant_easyparcel_config')
      .select('*')
      .eq('merchant_id', shipment.merchant_id)
      .maybeSingle()

    const epCallConfig = { 
      apiKey: epConfig?.api_key || c.env.EASYPARCEL_API_KEY, 
      authKey: epConfig?.auth_key || c.env.EASYPARCEL_AUTH_KEY,
      environment: epConfig?.environment || 'sandbox' 
    }

    const trackData = await callEasyParcel(supabase, order_id, 'MPTrackingBulk', {
      bulk: [{ order_no: shipment.ep_order_number }]
    }, epCallConfig)

    const result = trackData.result?.[0]
    if (result) {
      await supabase.from('easyparcel_shipments').update({
        order_status: result.status,
        ship_status: result.status,
        updated_at: new Date().toISOString()
      }).eq('id', shipment.id)
    }

    return c.json(trackData)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

export default easyparcel
