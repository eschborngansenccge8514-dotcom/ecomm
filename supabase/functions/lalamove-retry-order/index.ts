import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildLalamoveHeaders, getLalamoveBaseUrl } from '../_shared/lalamove-auth.ts'
import { retryWithBackoff, logLalamoveApi, fetchWithRetry } from '../_shared/utils.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const deliveryAddr = order.delivery_address as any
    const merchant     = order.merchant as any
    const serviceType  = order.delivery_service_id || 'MOTORCYCLE'

    // ── SECRETS ──────────────────────────────────────────────────────────
    // Reverted to global secrets as requested
    const apiKey    = Deno.env.get('LALAMOVE_API_KEY')!
    const apiSecret = Deno.env.get('LALAMOVE_API_SECRET')!
    const market    = Deno.env.get('LALAMOVE_MARKET') || 'MY_KUL'
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

    const merchLat = String(merchant.lat ?? '5.4141')
    const merchLng = String(merchant.lng ?? '100.3288')
    const custLatS = String(custLat ?? '5.4141')
    const custLngS = String(custLng ?? '100.3288')

    // 1. Get Fresh Quotation
    const quotePath = '/v3/quotations'
    const quoteBody = JSON.stringify({
      data: {
        serviceType,
        language: 'en_MY',
        stops: [
          {
            coordinates: { lat: merchLat, lng: merchLng },
            address: `${merchant.address_line1}, ${merchant.city}, ${merchant.state} ${merchant.postcode}`,
          },
          {
            coordinates: { lat: custLatS, lng: custLngS },
            address: `${deliveryAddr.line1}, ${deliveryAddr.city}, ${deliveryAddr.state} ${deliveryAddr.postcode}`,
          },
        ],
        item: { quantity: '1', weight: 'LESS_THAN_3_KG', categories: ['OTHER'] }
      },
    })

    const quoteHeaders = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', quotePath, quoteBody)
    const quoteRes = await fetchWithRetry(`${baseUrl}${quotePath}`, { method: 'POST', headers: quoteHeaders, body: quoteBody })
    const quoteData = await quoteRes.json()

    if (!quoteRes.ok) throw new Error(quoteData?.message ?? 'Failed to get fresh quote')

    const newQuotationId = quoteData.data.quotationId
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
    const createBody = JSON.stringify({
      data: {
        quotationId: newQuotationId,
        sender: {
          stopId: '0',
          name: merchant.store_name,
          phone: merchant.phone ?? '+60123456789',
        },
        recipients: [
          {
            stopId: '1',
            name: deliveryAddr.name,
            phone: deliveryAddr.phone,
            remarks: `Order ${order.order_number} (Retry #${retryCount + 1})`,
          },
        ],
        isPODEnabled: false,
        isRecipientSMSEnabled: true,
      },
    })

    const createHeaders = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', createPath, createBody)
    const createRes = await fetchWithRetry(`${baseUrl}${createPath}`, { method: 'POST', headers: createHeaders, body: createBody })
    const createResData = await createRes.json()

    if (!createRes.ok) throw new Error(createResData?.message ?? 'Lalamove booking failed')

    const newLalamoveOrderId = createResData.data.orderId

    // 4. Update order in DB
    await supabase.from('orders').update({
      lalamove_order_id: newLalamoveOrderId,
      lalamove_retry_count: retryCount + 1,
      delivery_fee: newPrice, // Update to new price if it changed
      exception_flag: null,
      exception_flagged_at: null,
      status: 'out_for_delivery',
      delivery_status: 'finding_driver',
      delivery_provider: 'lalamove'
    }).eq('id', orderId)

    // Log to exception logs
    await supabase.from('delivery_exception_logs').insert({
      order_id: orderId,
      type: 'retry_success',
      message: `Order retried successfully (Attempt ${retryCount + 1})`,
      raw_payload: createResData.data
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
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
