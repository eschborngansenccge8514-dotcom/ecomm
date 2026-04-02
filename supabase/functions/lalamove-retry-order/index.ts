import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildLalamoveHeaders, getLalamoveBaseUrl } from '../_shared/lalamove-auth.ts'
import { retryWithBackoff, logLalamoveApi, fetchWithRetry, getLalamoveErrorMessage } from '../_shared/utils.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Normalise Malaysian phone numbers to E.164 (+60XXXXXXXXX)
function normPhone(phone: string | null | undefined, fallback = '+60123456789'): string {
  if (!phone) return fallback
  const trimmed = phone.trim()
  if (trimmed.startsWith('+')) return trimmed
  if (trimmed.startsWith('60')) return '+' + trimmed
  if (trimmed.startsWith('0')) return '+60' + trimmed.slice(1)
  return fallback
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { orderId, confirmPriceChange = false } = await req.json()
    if (!orderId) throw new Error('orderId is required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, merchant:merchant_id(*)')
      .eq('id', orderId)
      .single()

    if (orderError || !order) throw new Error('Order not found')
    
    // Check retry count
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

    // ── SECRETS ──────────────────────────────────────────────────────────
    // Reverted to global secrets as requested
    const apiKey    = Deno.env.get('LALAMOVE_API_KEY')!
    const apiSecret = Deno.env.get('LALAMOVE_API_SECRET')!
    const market    = Deno.env.get('LALAMOVE_MARKET') || 'MY'
    const env       = Deno.env.get('DELIVERY_ENV')   || 'sandbox'
    const baseUrl   = getLalamoveBaseUrl(env)

    if (!apiKey || !apiSecret) {
      throw new Error('Lalamove platform secrets are not configured.')
    }
    // ──────────────────────────────────────────────────────────────────────


    // Resolve customer coordinates - delivery_address JSON rarely has lat/lng
    // so fall back to addresses table
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

    // Address sanitization to avoid 502 map crashes
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

    // 1. Get Fresh Quotation
    const quotePath = '/v3/quotations'
    const quoteBody = JSON.stringify({
      data: {
        serviceType,
        language: 'en_MY',
        stops: [
          { coordinates: { lat: merchLat, lng: merchLng }, address: pickupAddress },
          { coordinates: { lat: custLatS, lng: custLngS }, address: deliveryAddressStr },
        ],
        // Note: 'item' block is REMOVED to avoid 502 errors in Malaysia sandbox
      },
    })

    const quoteHeaders = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', quotePath, quoteBody, market)
    const { res: quoteRes, attempts: quoteAttempts } = await fetchWithRetry(`${baseUrl}${quotePath}`, { method: 'POST', headers: quoteHeaders, body: quoteBody })
    const quoteData = await quoteRes.json()

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

    // 2. Price Check (20% threshold)
    if (oldPrice > 0 && !confirmPriceChange) {
      const diffPct = (newPrice - oldPrice) / oldPrice
      if (diffPct > 0.20) {
        return new Response(JSON.stringify({ 
          priceChanged: true, 
          oldPrice, 
          newPrice,
          quotationId: newQuotationId
        }), {
          headers: { ...CORS, 'Content-Type': 'application/json' }
        })
      }
    }

    // 3. Create Order
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
        isPODEnabled: false,
      },
    })


    const createHeaders = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', createPath, createBody, market)
    const { res: createRes, attempts: createAttempts } = await fetchWithRetry(`${baseUrl}${createPath}`, { method: 'POST', headers: createHeaders, body: createBody })
    const createData = await createRes.json()

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

    // 4. Update order in DB
    const lalamoveData = createData.data
    await supabase.from('orders').update({
      lalamove_order_id: newLalamoveOrderId,
      lalamove_retry_count: retryCount + 1,
      delivery_fee: newPrice, // Update to new price if it changed
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

    // Log to exception logs
    await supabase.from('delivery_exception_logs').insert({
      order_id: orderId,
      type: 'retry_success',
      message: `Order retried successfully (Attempt ${retryCount + 1})`,
      raw_payload: createData.data
    })

    return new Response(JSON.stringify({ 
      success: true, 
      lalamoveOrderId: newLalamoveOrderId,
      attempt: retryCount + 1
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
