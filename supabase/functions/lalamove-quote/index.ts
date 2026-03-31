import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildLalamoveHeaders, getLalamoveBaseUrl } from '../_shared/lalamove-auth.ts'
import { retryWithBackoff, logLalamoveApi } from '../_shared/utils.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Lalamove service type codes for Malaysia
export const LALAMOVE_SERVICES = [
  { id: 'MOTORCYCLE',  label: 'Motorbike',       emoji: '🏍️',  maxKg: 10,  description: 'Up to 10 kg, small items, documents' },
  { id: 'SEDAN',       label: 'Car (Sedan)',      emoji: '🚗',  maxKg: 200, description: 'Up to 200 kg, medium boxes' },
  { id: 'VAN',         label: 'Van',              emoji: '🚐',  maxKg: 500, description: 'Up to 500 kg, bulky items' },
  { id: 'TRUCK175',    label: '1.75T Lorry',      emoji: '🚛',  maxKg: 1000,description: 'Large freight, furniture' },
]

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { orderId } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: order, error } = await supabase
      .from('orders')
      .select('*, merchant:merchant_id(store_name, address_line1, city, state, postcode, phone, lat, lng)')
      .eq('id', orderId)
      .single()

    if (error || !order) throw new Error('Order not found')

    const deliveryAddr = order.delivery_address as any
    const merchant     = order.merchant as any

    // Resolve customer coords — delivery_address JSON typically lacks lat/lng
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

    const apiKey    = Deno.env.get('LALAMOVE_API_KEY')!
    const apiSecret = Deno.env.get('LALAMOVE_API_SECRET')!
    const baseUrl   = getLalamoveBaseUrl()
    const path      = '/v3/quotations'

    const merchLat = String(merchant.lat  ?? '5.4141')
    const merchLng = String(merchant.lng  ?? '100.3288')
    const custLatS = String(custLat ?? '5.4141')
    const custLngS = String(custLng ?? '100.3288')

    const quotes = await Promise.all(
      LALAMOVE_SERVICES.map(async (svc) => {
        const body = JSON.stringify({
          data: {
            serviceType: svc.id,
            language:    'en_MY',
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
            item: { quantity: '1', weight: 'LESS_THAN_3_KG', categories: ['OTHER'] }
          },
        })

        try {
          const headers = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', path, body)
          const res     = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body })
          const resData = await res.json()

          await logLalamoveApi(supabase, orderId, {
            endpoint: path, method: 'POST',
            statusCode: res.status,
            requestBody: body,
            responseBody: resData,
            attempt: 1,
          })

          if (!res.ok) throw new Error(resData?.message)

          return {
            serviceType:  svc.id,
            label:        svc.label,
            emoji:        svc.emoji,
            description:  svc.description,
            maxKg:        svc.maxKg,
            available:    true,
            quotationId:  resData.data?.quotationId,
            priceBreakdown: resData.data?.priceBreakdown,
            totalPrice:   resData.data?.priceBreakdown?.total,
            currency:     resData.data?.priceBreakdown?.currency ?? 'MYR',
            expiresAt:    resData.data?.expiresAt,
          }
        } catch (e: any) {
          return { serviceType: svc.id, available: false, error: e.message || 'Request failed' }
        }
      })
    )

    return new Response(
      JSON.stringify({ quotes: quotes.filter(q => q.available) }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
