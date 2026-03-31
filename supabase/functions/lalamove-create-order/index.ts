import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildLalamoveHeaders, getLalamoveBaseUrl } from '../_shared/lalamove-auth.ts'
import { logLalamoveApi } from '../_shared/utils.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ok  = (d: unknown) => new Response(JSON.stringify(d), { headers: { ...CORS, 'Content-Type': 'application/json' } })
const err = (m: string, status = 200) => new Response(JSON.stringify({ error: m }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Retry wrapper for transient Lalamove sandbox 502/503/504 errors
async function fetchWithRetry(url: string, init: RequestInit, maxAttempts = 3): Promise<Response> {
  const delays = [0, 1000, 2000]
  let lastRes: Response | null = null
  for (let i = 0; i < maxAttempts; i++) {
    if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]))
    const res = await fetch(url, init)
    // Retry on transient gateway errors only
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      lastRes = res
      console.warn(`[lalamove-create-order] Attempt ${i + 1} got ${res.status}, retrying...`)
      continue
    }
    return res
  }
  return lastRes!
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { orderId, serviceType: overrideService } = await req.json()
    if (!orderId) return err('orderId is required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Fetch order + config
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, merchant:merchant_id(*)')
      .eq('id', orderId)
      .single()

    if (orderError || !order) return err('Order not found')

    const { data: llConfig } = await supabase
      .from('merchant_lalamove_config')
      .select('*')
      .eq('merchant_id', order.merchant_id)
      .single()

    // ── SECRETS ──────────────────────────────────────────────────────────
    // Reverted to global secrets as requested
    const apiKey    = Deno.env.get('LALAMOVE_API_KEY')
    const apiSecret = Deno.env.get('LALAMOVE_API_SECRET')
    const market    = Deno.env.get('LALAMOVE_MARKET') || 'MY_KUL'
    const env       = Deno.env.get('DELIVERY_ENV')   || 'sandbox'
    const baseUrl   = getLalamoveBaseUrl(env)

    if (!apiKey || !apiSecret) {
      return err('Lalamove platform secrets are not configured. Please contact support.')
    }
    // ──────────────────────────────────────────────────────────────────────

    const deliveryAddr = order.delivery_address as any
    const merchant     = order.merchant as any
    const serviceType  = overrideService || order.delivery_service_id || llConfig?.default_service_type || 'MOTORCYCLE'


    // 2. Resolve customer coordinates
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

    // Pickup details from config
    const merchLat = String(llConfig.pickup_lat || merchant.lat || '3.1486')
    const merchLng = String(llConfig.pickup_lng || merchant.lng || '101.6942')
    const custLatS = String(custLat || '3.1500')
    const custLngS = String(custLng || '101.7000')

    const pickupAddress = llConfig.pickup_address_text || 
      `${merchant.address_line1 ?? ''}, ${merchant.city ?? ''}, ${merchant.state} ${merchant.postcode}, Malaysia`

    const pickupContactName  = llConfig.pickup_contact_name || merchant.store_name || 'Merchant'
    const pickupContactPhone = llConfig.pickup_contact_phone || merchant.phone || '+60123456789'

    // 3. Get fresh quotation
    const quotePath = '/v3/quotations'
    const quoteBody = JSON.stringify({
      data: {
        serviceType,
        language: 'en_MY',
        stops: [
          {
            coordinates: { lat: merchLat, lng: merchLng },
            address:     pickupAddress,
          },
          {
            coordinates: { lat: custLatS, lng: custLngS },
            address:     `${deliveryAddr.line1 ?? ''}, ${deliveryAddr.city ?? ''}, ${deliveryAddr.state} ${deliveryAddr.postcode}, Malaysia`,
          },
        ],
        item: { quantity: '1', weight: 'LESS_THAN_3_KG', categories: ['OTHER'] }
      },
    })

    const quoteHeaders = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', quotePath, quoteBody, market)
    const quoteRes    = await fetchWithRetry(`${baseUrl}${quotePath}`, { method: 'POST', headers: quoteHeaders, body: quoteBody })
    const quoteData   = await quoteRes.json()

    await logLalamoveApi(supabase, orderId, {
      endpoint: quotePath, method: 'POST',
      statusCode: quoteRes.status,
      requestBody: quoteBody,
      responseBody: quoteData,
      attempt: 1,
    })

    if (!quoteRes.ok) {
      const msg = quoteData?.message ?? quoteData?.error?.message ?? `Quote failed (${quoteRes.status})`
      return err(`Lalamove quote error: ${msg}`)
    }

    const freshQuotationId = quoteData.data.quotationId

    // 4. Create Lalamove order
    const sanitize = (s: string) => (s ?? '').replace(/[^\x00-\x7F]/g, '').substring(0, 50)
    const createPath = '/v3/orders'
    const createBody = JSON.stringify({
      data: {
        quotationId: freshQuotationId,
        sender: {
          stopId: '0',
          name:   sanitize(pickupContactName),
          phone:  pickupContactPhone,
        },
        recipients: [
          {
            stopId:  '1',
            name:    sanitize(deliveryAddr.name || 'Customer'),
            phone:   deliveryAddr.phone,
            remarks: `Order ${order.order_number}`.substring(0, 100),
          },
        ],
        isPODEnabled: false,
        isRecipientSMSEnabled: true,
      },
    })

    const createHeaders = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', createPath, createBody, market)
    const createRes    = await fetchWithRetry(`${baseUrl}${createPath}`, { method: 'POST', headers: createHeaders, body: createBody })
    const createData   = await createRes.json()

    await logLalamoveApi(supabase, orderId, {
      endpoint: createPath, method: 'POST',
      statusCode: createRes.status,
      requestBody: createBody,
      responseBody: createData,
      attempt: 1,
    })

    if (!createRes.ok) {
      const msg = createData?.message ?? createData?.error?.message ?? `Booking failed (${createRes.status})`
      return err(`Lalamove booking error: ${msg}`)
    }

    const lalamoveOrderId = createData.data?.orderId

    // 5. Update order record
    await supabase.from('orders').update({
      status:            'out_for_delivery',
      delivery_status:   'finding_driver',
      delivery_provider: 'lalamove',
      delivery_type:     'instant',
      lalamove_order_id: lalamoveOrderId,
      delivery_quote_id: freshQuotationId,
    }).eq('id', orderId)

    await supabase.from('delivery_events').insert({
      order_id:    orderId,
      provider:    'lalamove',
      event_type:  'order_created',
      raw_payload: createData.data,
    })

    return ok({ success: true, lalamoveOrderId })

  } catch (e: any) {
    console.error('[lalamove-create-order] Unhandled error:', e.message)
    return err(e.message)
  }
})

