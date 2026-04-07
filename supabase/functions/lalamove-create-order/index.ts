import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildLalamoveHeaders, getLalamoveBaseUrl } from '../_shared/lalamove-auth.ts'
import { fetchWithRetry, logLalamoveApi, getLalamoveErrorMessage } from '../_shared/utils.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ok  = (d: unknown) => new Response(JSON.stringify(d), { headers: { ...CORS, 'Content-Type': 'application/json' } })
const err = (m: string, status = 400) => new Response(JSON.stringify({ error: m }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Normalise Malaysian phone numbers to E.164 (+60XXXXXXXXX)
function normPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const trimmed = phone.trim()
  if (trimmed.startsWith('+')) return trimmed          // already E.164
  if (trimmed.startsWith('60')) return '+' + trimmed   // 60X... -> +60X...
  if (trimmed.startsWith('0')) return '+60' + trimmed.slice(1) // 01X... -> +601X...
  return null
}



serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { orderId, serviceType: overrideService, quotationId: overrideQuoteId } = await req.json()
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

    // ── Pre-booking Balance Check ──────────────────────────────────────────
    const { data: wallet } = await supabase
      .from('merchant_wallets')
      .select('balance')
      .eq('merchant_id', order.merchant_id)
      .single()

    if (!wallet || Number(wallet.balance) < 10) {
      return err('Insufficient wallet balance. Please top up at least RM 10.00 to book deliveries.')
    }
    // ──────────────────────────────────────────────────────────────────────

    const { data: llConfig } = await supabase
      .from('merchant_lalamove_config')
      .select('*')
      .eq('merchant_id', order.merchant_id)
      .maybeSingle()

    if (!llConfig) {
      console.warn(`[lalamove-create-order] No Lalamove config found for merchant ${order.merchant_id}. Using merchant defaults.`)
    }

    // ── SECRETS ──────────────────────────────────────────────────────────
    const apiKey    = (llConfig?.is_enabled && llConfig?.api_key) ? llConfig.api_key : Deno.env.get('LALAMOVE_API_KEY')
    const apiSecret = (llConfig?.is_enabled && llConfig?.api_secret) ? llConfig.api_secret : Deno.env.get('LALAMOVE_API_SECRET')
    const market    = llConfig?.market || Deno.env.get('LALAMOVE_MARKET') || 'MY'
    const env       = (llConfig?.is_enabled && llConfig?.environment) ? llConfig.environment : (Deno.env.get('DELIVERY_ENV') || 'sandbox')
    const baseUrl   = getLalamoveBaseUrl(env)

    if (!apiKey || !apiSecret) {
      return err('Lalamove platform secrets are not configured. Please contact support.')
    }
    // ──────────────────────────────────────────────────────────────────────

    const deliveryAddr = order.delivery_address as any
    const merchant     = order.merchant as any
    const rawDeliveryService = order.delivery_service_id || ''
    const isInvalidServiceString = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawDeliveryService) || /^\d+$/.test(rawDeliveryService)
    const serviceType  = overrideService || (isInvalidServiceString ? null : order.delivery_service_id) || llConfig?.default_service_type || 'MOTORCYCLE'


    // 2. Resolve existing quotation or create a new one
    let freshQuotationId = overrideQuoteId || order.delivery_quote_id
    let senderStopId     = ''
    let recipientStopId  = ''

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

    const merchLat = String(llConfig?.pickup_lat || merchant.lat || '5.4141')
    const merchLng = String(llConfig?.pickup_lng || merchant.lng || '100.3288')
    const custLatS = String(deliveryAddr?.lat || '5.4141')
    const custLngS = String(deliveryAddr?.lng || '100.3288')

    let quoteData: any = null
    if (!freshQuotationId) {
      console.log(`[lalamove-create-order] No quotation ID found for order ${orderId}. Creating new quotation...`)
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
      const { res: qRes1, attempts: qAttempts1 } = await fetchWithRetry(`${baseUrl}${quotePath}`, { method: 'POST', headers: quoteHeaders, body: quoteBody })
      quoteData = await qRes1.json()

      await logLalamoveApi(supabase, orderId, {
        endpoint: quotePath, method: 'POST',
        statusCode: qRes1.status,
        requestBody: quoteBody,
        responseBody: quoteData,
        attempt: qAttempts1,
      })

      if (!qRes1.ok) {
        const msg = quoteData?.message ?? quoteData?.error?.message ?? `Quotation creation failed (${qRes1.status})`
        return err(`Lalamove quotation error: ${msg}`)
      }
      freshQuotationId = quoteData.data.quotationId
      senderStopId     = quoteData.data.stops[0].stopId
      recipientStopId  = quoteData.data.stops[1].stopId
    } else {
      // 3. Fetch existing quotation details to get stop IDs
      const quotePath = `/v3/quotations/${freshQuotationId}`
      const quoteHeaders = await buildLalamoveHeaders(apiKey, apiSecret, 'GET', quotePath, '', market)
      const { res: qRes2, attempts: qAttempts2 } = await fetchWithRetry(`${baseUrl}${quotePath}`, { method: 'GET', headers: quoteHeaders })
      quoteData = await qRes2.json()

      await logLalamoveApi(supabase, orderId, {
        endpoint: quotePath, method: 'GET',
        statusCode: qRes2.status,
        requestBody: '',
        responseBody: quoteData,
        attempt: qAttempts2,
      })

      if (!qRes2.ok) {
        const msg = getLalamoveErrorMessage(quoteData, `Quotation fetch failed (${qRes2.status})`)
        return err(`Lalamove quotation error: ${msg}`)
      }

      senderStopId    = quoteData.data.stops[0].stopId
      recipientStopId = quoteData.data.stops[1].stopId
    }

    const validatedDeliveryPhone = normPhone(deliveryAddr?.phone)
    if (!validatedDeliveryPhone) {
      return err('Customer phone number is missing or invalid')
    }

    const pickupContactName  = llConfig?.pickup_contact_name || merchant?.store_name || 'Merchant'
    const pickupContactPhone = normPhone(llConfig?.pickup_contact_phone || merchant?.phone) || '+60123456789'


    // 4. Create Lalamove order
    const sanitize = (s: string) => (s ?? '').replace(/[^\x00-\x7F]/g, '').substring(0, 50)
    const createPath = '/v3/orders'
    const createBody = JSON.stringify({
      data: {
        quotationId: freshQuotationId,
        sender: {
          stopId: senderStopId,
          name:   sanitize(pickupContactName),
          phone:  pickupContactPhone,
        },
        recipients: [
          {
            stopId:  recipientStopId,
            name:    sanitize(deliveryAddr.name || 'Customer'),
            phone:   validatedDeliveryPhone,
            remarks: `Order ${order.order_number}`.substring(0, 100),
          },
        ],
        isPODEnabled: llConfig?.is_pod_enabled ?? false,
        metadata: {
          orderNumber: order.order_number,
          merchantId:  order.merchant_id,
          source:      'hyperlocal-dashboard'
        }
      },
    })

    const createHeaders = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', createPath, createBody, market)
    const { res: createRes, attempts: createAttempts }    = await fetchWithRetry(`${baseUrl}${createPath}`, { method: 'POST', headers: createHeaders, body: createBody })
    const createData   = await createRes.json()

    await logLalamoveApi(supabase, orderId, {
      endpoint: createPath, method: 'POST',
      statusCode: createRes.status,
      requestBody: createBody,
      responseBody: createData,
      attempt: createAttempts,
    }) 

     if (!createRes.ok) {
      const msg = getLalamoveErrorMessage(createData, `Booking failed (${createRes.status})`)
      return err(`Lalamove booking error: ${msg}`)
    }

    const lalamoveOrderId = createData.data?.orderId
    const lalamoveData = createData.data
    const totalFee = Number(lalamoveData?.priceBreakdown?.total || 0)

    // 4.5 Deduct from wallet
    if (totalFee > 0) {
      try {
        await supabase.rpc('deduct_shipping_wallet_balance', {
          p_merchant_id: order.merchant_id,
          p_amount:      totalFee,
          p_order_id:    orderId,
          p_description: `Lalamove booking for order ${order.order_number}`
        })
      } catch (deductErr: any) {
        console.error('[lalamove-create-order] Wallet deduction failed:', deductErr.message)
      }
    }

    // 5. Update order record
    const { error: updateError } = await supabase.from('orders').update({
      status:            'confirmed',
      delivery_status:   'finding_driver',
      delivery_provider: 'lalamove',
      delivery_type:     'instant',
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

    if (updateError) {
      console.error('[lalamove-create-order] DB update orders failed:', updateError)
    }

    const { error: insertError } = await supabase.from('delivery_events').insert({
      order_id:    orderId,
      provider:    'lalamove',
      event_type:  'order_created',
      raw_payload: createData.data,
    })

    if (insertError) {
      console.error('[lalamove-create-order] DB insert delivery_events failed:', insertError)
    }

    return ok({ success: true, lalamoveOrderId })

  } catch (e: any) {
    console.error('[lalamove-create-order] Unhandled error:', e.message, e.stack)
    return err(e.message, 500)
  }
})

