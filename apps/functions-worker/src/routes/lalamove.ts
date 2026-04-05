import { Hono } from 'hono'
import { getSupabaseClient, Bindings } from '../lib/supabase'
import { buildLalamoveHeaders, getLalamoveBaseUrl, getLalamoveErrorMessage, normPhone } from '../lib/lalamove'
import { fetchWithRetry, logLalamoveApi } from '../lib/utils'

const lalamove = new Hono<{ Bindings: Bindings }>()

const LALAMOVE_SERVICES = [
  { id: 'MOTORCYCLE', label: 'Motorbike', emoji: '🏍️', maxKg: 10, description: 'Up to 10 kg, small items, documents' },
  { id: 'SEDAN', label: 'Car (Sedan)', emoji: '🚗', maxKg: 200, description: 'Up to 200 kg, medium boxes' },
  { id: 'VAN', label: 'Van', emoji: '🚐', maxKg: 500, description: 'Up to 500 kg, bulky items' },
  { id: 'TRUCK175', label: '1.75T Lorry', emoji: '🚛', maxKg: 1000, description: 'Large freight, furniture' },
]

lalamove.post('/quote', async (c) => {
  try {
    const { orderId } = await c.req.json()
    const supabase = getSupabaseClient(c.env)

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, merchant:merchant_id(*)')
      .eq('id', orderId)
      .single()

    if (error || !order) throw new Error('Order not found')

    const deliveryAddr = order.delivery_address as any
    const merchant = order.merchant as any

    let custLat = deliveryAddr?.lat
    let custLng = deliveryAddr?.lng

    if (!custLat || !custLng) {
      const { data: addrRow } = await supabase
        .from('addresses')
        .select('lat, lng')
        .eq('customer_id', order.customer_id)
        .eq('postcode', deliveryAddr?.postcode)
        .maybeSingle()
      custLat = addrRow?.lat
      custLng = addrRow?.lng
    }

    const apiKey = c.env.LALAMOVE_API_KEY
    const apiSecret = c.env.LALAMOVE_API_SECRET
    const market = 'MY'
    const env = c.env.LALAMOVE_SANDBOX === 'true' ? 'sandbox' : 'production'
    const baseUrl = getLalamoveBaseUrl(env)
    const path = '/v3/quotations'

    const merchLat = String(merchant.lat ?? '5.4141')
    const merchLng = String(merchant.lng ?? '100.3288')
    const custLatS = String(custLat ?? '5.4141')
    const custLngS = String(custLng ?? '100.3288')

    const quotes = await Promise.all(
      LALAMOVE_SERVICES.map(async (svc) => {
        const body = JSON.stringify({
          data: {
            serviceType: svc.id,
            language: 'en_MY',
            stops: [
              {
                coordinates: { lat: merchLat, lng: merchLng },
                address: `${merchant.address_line1}, ${merchant.city}, ${merchant.state} ${merchant.postcode}`,
              },
              {
                coordinates: { lat: custLatS, lng: custLngS },
                address: `${deliveryAddr.line1}${deliveryAddr.line2 ? ', ' + deliveryAddr.line2 : ''}, ${deliveryAddr.city}, ${deliveryAddr.state} ${deliveryAddr.postcode}`,
              },
            ],
          },
        })

        try {
          const headers = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', path, body, market)
          const { res, attempts } = await fetchWithRetry(`${baseUrl}${path}`, { method: 'POST', headers, body })
          const resData = (await res.json()) as any

          await logLalamoveApi(supabase, orderId, {
            endpoint: path, method: 'POST',
            statusCode: res.status,
            requestBody: body,
            responseBody: resData,
            attempt: attempts,
          })

          if (!res.ok) {
            const msg = getLalamoveErrorMessage(resData, `Request failed (${res.status})`)
            throw new Error(msg)
          }

          return {
            serviceType: svc.id,
            label: svc.label,
            emoji: svc.emoji,
            description: svc.description,
            maxKg: svc.maxKg,
            available: true,
            quotationId: resData.data?.quotationId,
            priceBreakdown: resData.data?.priceBreakdown,
            totalPrice: resData.data?.priceBreakdown?.total,
            currency: resData.data?.priceBreakdown?.currency ?? 'MYR',
            expiresAt: resData.data?.expiresAt,
          }
        } catch (e: any) {
          return { serviceType: svc.id, available: false, error: e.message || 'Request failed' }
        }
      })
    )

    return c.json({ quotes: quotes.filter(q => (q as any).available) })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

lalamove.post('/create-order', async (c) => {
  try {
    const { orderId, serviceType: overrideService, quotationId: overrideQuoteId } = await c.req.json()
    if (!orderId) return c.json({ error: 'orderId is required' }, 400)

    const supabase = getSupabaseClient(c.env)

    // 1. Fetch order + config
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, merchant:merchant_id(*)')
      .eq('id', orderId)
      .single()

    if (orderError || !order) return c.json({ error: 'Order not found' }, 404)

    const { data: llConfig } = await supabase
      .from('merchant_lalamove_config')
      .select('*')
      .eq('merchant_id', order.merchant_id)
      .maybeSingle()

    const apiKey = c.env.LALAMOVE_API_KEY
    const apiSecret = c.env.LALAMOVE_API_SECRET
    const market = 'MY'
    const env = c.env.LALAMOVE_SANDBOX === 'true' ? 'sandbox' : 'production'
    const baseUrl = getLalamoveBaseUrl(env)

    if (!apiKey || !apiSecret) {
      return c.json({ error: 'Lalamove platform secrets are not configured.' }, 400)
    }

    const deliveryAddr = order.delivery_address as any
    const merchant = order.merchant as any
    const serviceType = overrideService || order.delivery_service_id || llConfig?.default_service_type || 'MOTORCYCLE'

    // 2. Resolve existing quotation or create a new one
    let freshQuotationId = overrideQuoteId || order.delivery_quote_id
    let senderStopId = ''
    let recipientStopId = ''

    const buildAddr = (obj: any) => [obj.line1, obj.line2, obj.city, obj.state, obj.postcode, 'Malaysia']
      .filter(Boolean).map(s => String(s).trim()).filter(s => s !== '').join(', ')

    const pickupAddress = llConfig?.pickup_address_text || buildAddr({
      line1: merchant.address_line1,
      line2: merchant.line2,
      city: merchant.city,
      state: merchant.state,
      postcode: merchant.postcode
    })
    const deliveryAddressStr = buildAddr(deliveryAddr)

    const merchLat = String(llConfig?.pickup_lat || merchant.lat || '5.4141')
    const merchLng = String(llConfig?.pickup_lng || merchant.lng || '100.3288')
    const custLatS = String(deliveryAddr?.lat || '5.4141')
    const custLngS = String(deliveryAddr?.lng || '100.3288')

    let quoteData: any = null
    if (!freshQuotationId) {
      const quotePath = '/v3/quotations'
      const quoteBody = JSON.stringify({
        data: {
          serviceType,
          language: 'en_MY',
          stops: [
            { coordinates: { lat: merchLat, lng: merchLng }, address: pickupAddress },
            { coordinates: { lat: custLatS, lng: custLngS }, address: deliveryAddressStr },
          ],
        },
      })
      const quoteHeaders = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', quotePath, quoteBody, market)
      const { res: qRes1, attempts: qAttempts1 } = await fetchWithRetry(`${baseUrl}${quotePath}`, { method: 'POST', headers: quoteHeaders, body: quoteBody })
      quoteData = (await qRes1.json()) as any

      await logLalamoveApi(supabase, orderId, {
        endpoint: quotePath, method: 'POST',
        statusCode: qRes1.status,
        requestBody: quoteBody,
        responseBody: quoteData,
        attempt: qAttempts1,
      })

      if (!qRes1.ok) {
        const msg = getLalamoveErrorMessage(quoteData, `Quotation creation failed (${qRes1.status})`)
        return c.json({ error: `Lalamove quotation error: ${msg}` }, 400)
      }
      freshQuotationId = quoteData.data.quotationId
      senderStopId = quoteData.data.stops[0].stopId
      recipientStopId = quoteData.data.stops[1].stopId
    } else {
      const quotePath = `/v3/quotations/${freshQuotationId}`
      const quoteHeaders = await buildLalamoveHeaders(apiKey, apiSecret, 'GET', quotePath, '', market)
      const { res: qRes2, attempts: qAttempts2 } = await fetchWithRetry(`${baseUrl}${quotePath}`, { method: 'GET', headers: quoteHeaders })
      quoteData = (await qRes2.json()) as any

      await logLalamoveApi(supabase, orderId, {
        endpoint: quotePath, method: 'GET',
        statusCode: qRes2.status,
        requestBody: '',
        responseBody: quoteData,
        attempt: qAttempts2,
      })

      if (!qRes2.ok) {
        const msg = getLalamoveErrorMessage(quoteData, `Quotation fetch failed (${qRes2.status})`)
        return c.json({ error: `Lalamove quotation error: ${msg}` }, 400)
      }

      senderStopId = quoteData.data.stops[0].stopId
      recipientStopId = quoteData.data.stops[1].stopId
    }

    const validatedDeliveryPhone = normPhone(deliveryAddr?.phone)
    if (!validatedDeliveryPhone) return c.json({ error: 'Customer phone number is missing or invalid' }, 400)

    const pickupContactName = llConfig?.pickup_contact_name || merchant?.store_name || 'Merchant'
    const pickupContactPhone = normPhone(llConfig?.pickup_contact_phone || merchant?.phone) || '+60123456789'

    // 4. Create Lalamove order
    const sanitize = (s: string) => (s ?? '').replace(/[^\x00-\x7F]/g, '').substring(0, 50)
    const createPath = '/v3/orders'
    const createBody = JSON.stringify({
      data: {
        quotationId: freshQuotationId,
        sender: {
          stopId: senderStopId,
          name: sanitize(pickupContactName),
          phone: pickupContactPhone,
        },
        recipients: [
          {
            stopId: recipientStopId,
            name: sanitize(deliveryAddr.name || 'Customer'),
            phone: validatedDeliveryPhone,
            remarks: `Order ${order.order_number}`.substring(0, 100),
          },
        ],
        isPODEnabled: llConfig?.is_pod_enabled ?? false,
        metadata: {
          orderNumber: order.order_number,
          merchantId: order.merchant_id,
          source: 'hyperlocal-dashboard'
        }
      },
    })

    const createHeaders = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', createPath, createBody, market)
    const { res: createRes, attempts: createAttempts } = await fetchWithRetry(`${baseUrl}${createPath}`, { method: 'POST', headers: createHeaders, body: createBody })
    const createData = (await createRes.json()) as any

    await logLalamoveApi(supabase, orderId, {
      endpoint: createPath, method: 'POST',
      statusCode: createRes.status,
      requestBody: createBody,
      responseBody: createData,
      attempt: createAttempts,
    })

    if (!createRes.ok) {
      const msg = getLalamoveErrorMessage(createData, `Booking failed (${createRes.status})`)
      return c.json({ error: `Lalamove booking error: ${msg}` }, 400)
    }

    const lalamoveOrderId = createData.data?.orderId
    const lalamoveData = createData.data

    // 5. Update order record
    await supabase.from('orders').update({
      status: 'confirmed',
      delivery_status: 'finding_driver',
      delivery_provider: 'lalamove',
      delivery_type: 'instant',
      lalamove_order_id: lalamoveOrderId,
      delivery_quote_id: freshQuotationId,
      delivery_metadata: {
        lalamove: {
          distance: lalamoveData?.distance,
          priceBreakdown: lalamoveData?.priceBreakdown,
          stops: lalamoveData?.stops
        }
      }
    }).eq('id', orderId)

    await supabase.from('delivery_events').insert({
      order_id: orderId,
      provider: 'lalamove',
      event_type: 'order_created',
      raw_payload: createData.data,
    })

    return c.json({ success: true, orderNo: order.order_number, status: 'ASSIGNING_DRIVER' })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

lalamove.post('/status', async (c) => {
  try {
    const { orderId } = await c.req.json()
    const supabase = getSupabaseClient(c.env)
    const { data: order } = await supabase.from('orders').select('lalamove_order_id, delivery_status').eq('id', orderId).single()
    if (!order?.lalamove_order_id) throw new Error('No Lalamove order found')

    const env = c.env.LALAMOVE_SANDBOX === 'true' ? 'sandbox' : 'production'
    const baseUrl = getLalamoveBaseUrl(env)
    const path = `/v3/orders/${order.lalamove_order_id}`
    const headers = await buildLalamoveHeaders(c.env.LALAMOVE_API_KEY, c.env.LALAMOVE_API_SECRET, 'GET', path, '', 'MY')
    
    const res = await fetch(`${baseUrl}${path}`, { headers })
    const data = (await res.json()) as any
    if (!res.ok) throw new Error(getLalamoveErrorMessage(data, 'Failed to fetch status'))

    return c.json(data.data)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

lalamove.post('/cancel', async (c) => {
  try {
    const { orderId } = await c.req.json()
    const supabase = getSupabaseClient(c.env)
    const { data: order } = await supabase.from('orders').select('id, lalamove_order_id').eq('id', orderId).single()
    if (!order?.lalamove_order_id) throw new Error('No Lalamove order to cancel')

    const env = c.env.LALAMOVE_SANDBOX === 'true' ? 'sandbox' : 'production'
    const baseUrl = getLalamoveBaseUrl(env)
    const path = `/v3/orders/${order.lalamove_order_id}`
    const headers = await buildLalamoveHeaders(c.env.LALAMOVE_API_KEY, c.env.LALAMOVE_API_SECRET, 'DELETE', path, '', 'MY')

    const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE', headers })
    const data = (await res.json()) as any

    if (res.ok || res.status === 404) {
      await supabase.from('orders').update({ delivery_status: 'cancelled', lalamove_order_id: null }).eq('id', orderId)
      return c.json({ success: true, message: 'Cancelled' })
    }

    return c.json({ success: true, message: 'Cancelled' })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

lalamove.post('/test-connection', async (c) => {
  try {
    const env = c.env.LALAMOVE_SANDBOX === 'true' ? 'sandbox' : 'production'
    const baseUrl = getLalamoveBaseUrl(env)
    const path = '/v3/city-infos'
    const headers = await buildLalamoveHeaders(c.env.LALAMOVE_API_KEY, c.env.LALAMOVE_API_SECRET, 'GET', path, '', 'MY')
    const res = await fetch(`${baseUrl}${path}`, { headers })
    const data = await res.json()
    if (!res.ok) throw new Error('Connection failed')
    return c.json({ success: true, data })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

lalamove.post('/add-priority-fee', async (c) => {
  try {
    const { orderId, tipAmount } = await c.req.json()
    if (!orderId || !tipAmount) throw new Error('orderId and tipAmount are required')

    const tipAmountNum = parseFloat(tipAmount)
    if (isNaN(tipAmountNum) || tipAmountNum < 1 || tipAmountNum > 50) {
      throw new Error('Tip amount must be between RM 1 and RM 50')
    }

    const supabase = getSupabaseClient(c.env)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, lalamove_order_id, priority_fee_added')
      .eq('id', orderId)
      .single()

    if (orderError || !order) throw new Error('Order not found')
    if (!order.lalamove_order_id) throw new Error('Lalamove order ID missing — delivery may not have been booked yet')

    const apiKey = c.env.LALAMOVE_API_KEY
    const apiSecret = c.env.LALAMOVE_API_SECRET
    const market = 'MY'
    const env = c.env.LALAMOVE_SANDBOX === 'true' ? 'sandbox' : 'production'
    const baseUrl = getLalamoveBaseUrl(env)

    const path = `/v3/orders/${order.lalamove_order_id}/priority-fee`
    const body = JSON.stringify({
      data: {
        priorityFee: tipAmountNum.toFixed(2)
      }
    })

    const headers = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', path, body, market)
    const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body })
    const responseData = (await res.json()) as any

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

    return c.json({ 
      success: true, 
      priorityFeeAdded: tipAmountNum,
      totalPriorityFee: newPriorityFee
    })

  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

lalamove.post('/retry-order', async (c) => {
  try {
    const { orderId, confirmPriceChange = false } = await c.req.json()
    if (!orderId) throw new Error('orderId is required')

    const supabase = getSupabaseClient(c.env)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, merchant:merchant_id(*)')
      .eq('id', orderId)
      .single()

    if (orderError || !order) throw new Error('Order not found')
    
    const retryCount = order.lalamove_retry_count || 0
    if (retryCount >= 3) {
      throw new Error('Maximum retry attempts exceeded (3)')
    }

    const { data: llConfig } = await supabase
      .from('merchant_lalamove_config')
      .select('*')
      .eq('merchant_id', order.merchant_id)
      .maybeSingle()

    const deliveryAddr = order.delivery_address as any
    const merchant     = order.merchant as any
    const serviceType  = order.delivery_service_id || 'MOTORCYCLE'

    const apiKey = c.env.LALAMOVE_API_KEY
    const apiSecret = c.env.LALAMOVE_API_SECRET
    const market = 'MY'
    const env = c.env.LALAMOVE_SANDBOX === 'true' ? 'sandbox' : 'production'
    const baseUrl = getLalamoveBaseUrl(env)

    if (!apiKey || !apiSecret) {
      throw new Error('Lalamove platform secrets are not configured.')
    }

    let custLat = deliveryAddr?.lat
    let custLng = deliveryAddr?.lng

    if (!custLat || !custLng) {
      const { data: addrRow } = await supabase
        .from('addresses')
        .select('lat, lng')
        .eq('user_id', order.customer_id)
        .eq('postcode', deliveryAddr?.postcode)
        .maybeSingle()
      custLat = addrRow?.lat
      custLng = addrRow?.lng
    }

    const merchLat = String(llConfig?.pickup_lat || merchant.lat || '5.4141')
    const merchLng = String(llConfig?.pickup_lng || merchant.lng || '100.3288')
    const custLatS = String(deliveryAddr?.lat || '5.4141')
    const custLngS = String(deliveryAddr?.lng || '100.3288')

    const buildAddr = (obj: any) => [obj.line1, obj.line2, obj.city, obj.state, obj.postcode, 'Malaysia']
      .filter(Boolean).map(s => String(s).trim()).filter(s => s !== '').join(', ')

    const pickupAddress  = llConfig?.pickup_address_text || buildAddr({
      line1:    merchant.address_line1,
      line2:    merchant.line2,
      city:     merchant.city,
      state:    merchant.state,
      postcode: merchant.postcode
    })
    const deliveryAddressStr = buildAddr(deliveryAddr)

    const quotePath = '/v3/quotations'
    const quoteBody = JSON.stringify({
      data: {
        serviceType,
        language: 'en_MY',
        stops: [
          { coordinates: { lat: merchLat, lng: merchLng }, address: pickupAddress },
          { coordinates: { lat: custLatS, lng: custLngS }, address: deliveryAddressStr },
        ]
      },
    })

    const quoteHeaders = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', quotePath, quoteBody, market)
    const { res: quoteRes, attempts: quoteAttempts } = await fetchWithRetry(`${baseUrl}${quotePath}`, { method: 'POST', headers: quoteHeaders, body: quoteBody })
    const quoteData = (await quoteRes.json()) as any

    await logLalamoveApi(supabase, orderId, {
      endpoint: quotePath, method: 'POST',
      statusCode: quoteRes.status,
      requestBody: quoteBody,
      responseBody: quoteData,
      attempt: quoteAttempts,
    })

    if (!quoteRes.ok) {
      throw new Error(getLalamoveErrorMessage(quoteData, 'Failed to get fresh quote'))
    }

    const newQuotationId = quoteData.data.quotationId
    const senderStopId    = quoteData.data.stops[0].stopId
    const recipientStopId = quoteData.data.stops[1].stopId
    const newPrice = parseFloat(quoteData.data.priceBreakdown.total)
    const oldPrice = parseFloat(order.delivery_fee as any) || 0

    if (oldPrice > 0 && !confirmPriceChange) {
      const diffPct = (newPrice - oldPrice) / oldPrice
      if (diffPct > 0.20) {
        return c.json({ 
          priceChanged: true, 
          oldPrice, 
          newPrice,
          quotationId: newQuotationId
        })
      }
    }

    const createPath = '/v3/orders'
    const sanitize = (s: string) => (s ?? '').replace(/[^\x00-\x7F]/g, '').substring(0, 50)
    const createBody = JSON.stringify({
      data: {
        quotationId: newQuotationId,
        sender: {
          stopId: senderStopId,
          name: sanitize(llConfig?.pickup_contact_name || merchant.store_name || 'Merchant'),
          phone: normPhone(llConfig?.pickup_contact_phone || merchant.phone) || '+60123456789',
        },
        recipients: [
          {
            stopId: recipientStopId,
            name: sanitize(deliveryAddr.name || 'Customer'),
            phone: normPhone(deliveryAddr.phone) || '+60123456789',
            remarks: `Order ${order.order_number} (Retry #${retryCount + 1})`.substring(0, 100),
          },
        ],
        isPODEnabled: llConfig?.is_pod_enabled ?? false,
      },
    })

    const createHeaders = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', createPath, createBody, market)
    const { res: createRes, attempts: createAttempts } = await fetchWithRetry(`${baseUrl}${createPath}`, { method: 'POST', headers: createHeaders, body: createBody })
    const createData = (await createRes.json()) as any

    await logLalamoveApi(supabase, orderId, {
      endpoint: createPath, method: 'POST',
      statusCode: createRes.status,
      requestBody: createBody,
      responseBody: createData,
      attempt: createAttempts,
    })

    if (!createRes.ok) {
      throw new Error(getLalamoveErrorMessage(createData, 'Lalamove booking failed'))
    }

    const newLalamoveOrderId = createData.data.orderId
    const lalamoveData = createData.data

    await supabase.from('orders').update({
      lalamove_order_id: newLalamoveOrderId,
      lalamove_retry_count: retryCount + 1,
      delivery_fee: newPrice,
      exception_flag: null,
      exception_flagged_at: null,
      status: 'confirmed',
      delivery_status: 'finding_driver',
      delivery_provider: 'lalamove',
      delivery_metadata: {
        lalamove: {
          distance: lalamoveData?.distance,
          priceBreakdown: lalamoveData?.priceBreakdown,
          stops: lalamoveData?.stops
        }
      }
    }).eq('id', orderId)

    await supabase.from('delivery_exception_logs').insert({
      order_id: orderId,
      type: 'retry_success',
      message: `Order retried successfully (Attempt ${retryCount + 1})`,
      raw_payload: createData.data
    })

    return c.json({ 
      success: true, 
      lalamoveOrderId: newLalamoveOrderId,
      attempt: retryCount + 1
    })

  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

export default lalamove
