<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Continue with delivery

Here is the complete delivery integration — 12 files covering Lalamove (on-demand) and EasyParcel (courier), backend to merchant UI.

***

## Architecture

```
Customer checkout
  └─ picks delivery type: Instant (Lalamove) | Courier (EasyParcel)
       └─ Edge Function gets rate quote → shows price to customer

Order confirmed (merchant accepts)
  └─ Merchant opens delivery booking sheet
       └─ Lalamove: shows motorbike/car/van options + live price
          EasyParcel: shows Poslaju/Skynet/DHL options + price
       └─ Merchant taps "Book"
            └─ Edge Function creates booking
               Tracking URL saved to orders table
               Customer order detail shows "Out for Delivery"
```


***

## Step 1 — Secrets

```bash
# Lalamove (get from partners.lalamove.com)
supabase secrets set LALAMOVE_API_KEY=your_api_key_here
supabase secrets set LALAMOVE_API_SECRET=your_api_secret_here
supabase secrets set LALAMOVE_MARKET=MY

# EasyParcel (get from app.easyparcel.com > Settings > API)
supabase secrets set EASYPARCEL_API_KEY=your_api_key_here

# Environment flag — change to 'production' when going live
supabase secrets set DELIVERY_ENV=sandbox
```


***

## Step 2 — Database Migration

Run in Supabase SQL Editor:

```sql
-- Add delivery fields to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_provider   text,          -- 'lalamove' | 'easyparcel' | 'self' | 'cod'
  ADD COLUMN IF NOT EXISTS delivery_type       text,          -- 'instant' | 'courier' | 'self_pickup'
  ADD COLUMN IF NOT EXISTS delivery_service_id text,          -- service_id from EasyParcel rate check
  ADD COLUMN IF NOT EXISTS lalamove_order_id   text,
  ADD COLUMN IF NOT EXISTS easyparcel_order_no text,
  ADD COLUMN IF NOT EXISTS tracking_number     text,          -- AWB for EasyParcel
  ADD COLUMN IF NOT EXISTS tracking_url        text,
  ADD COLUMN IF NOT EXISTS delivery_quote_id   text,          -- Lalamove quotation ID
  ADD COLUMN IF NOT EXISTS driver_name         text,
  ADD COLUMN IF NOT EXISTS driver_phone        text,
  ADD COLUMN IF NOT EXISTS driver_plate        text;

-- Delivery events log
CREATE TABLE IF NOT EXISTS delivery_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid        REFERENCES orders(id) ON DELETE SET NULL,
  provider     text        NOT NULL,
  event_type   text        NOT NULL,
  raw_payload  jsonb,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE delivery_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON delivery_events USING (false) WITH CHECK (false);
```


***

## File 1 — `supabase/functions/_shared/lalamove-auth.ts`

```typescript
import { hmac } from 'https://deno.land/x/hmac@v2.0.1/mod.ts'

export function buildLalamoveHeaders(
  apiKey:    string,
  apiSecret: string,
  method:    string,
  path:      string,
  body:      string = ''
): HeadersInit {
  const timestamp = String(Date.now())
  const nonce     = crypto.randomUUID().replace(/-/g, '')

  // Lalamove v3 signature format [web:17]
  const rawSignature = `${timestamp}\r\n${nonce}\r\n${method.toUpperCase()}\r\n${path}\r\n\r\n${body}`
  const signature    = hmac('sha256', apiSecret, rawSignature, 'utf8', 'hex') as string
  const token        = `${apiKey}:${timestamp}:${nonce}:${signature}`

  return {
    'Authorization': `hmac ${token}`,
    'Content-Type':  'application/json',
    'Market':        Deno.env.get('LALAMOVE_MARKET') ?? 'MY',
    'Accept':        'application/json',
  }
}

export function getLalamoveBaseUrl(): string {
  const env = Deno.env.get('DELIVERY_ENV') ?? 'sandbox'
  return env === 'production'
    ? 'https://rest.lalamove.com'
    : 'https://rest.sandbox.lalamove.com'
}
```


***

## File 2 — `supabase/functions/lalamove-quote/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildLalamoveHeaders, getLalamoveBaseUrl } from '../_shared/lalamove-auth.ts'

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

    // Fetch order + merchant + delivery address
    const { data: order, error } = await supabase
      .from('orders')
      .select('*, merchant:merchant_id(store_name, address_line1, city, state, postcode, phone, lat, lng)')
      .eq('id', orderId)
      .single()

    if (error || !order) throw new Error('Order not found')

    const deliveryAddr = order.delivery_address as any
    const merchant     = order.merchant as any

    const apiKey    = Deno.env.get('LALAMOVE_API_KEY')!
    const apiSecret = Deno.env.get('LALAMOVE_API_SECRET')!
    const baseUrl   = getLalamoveBaseUrl()
    const path      = '/v3/quotations'

    // Build quotation request for all service types in parallel
    const quotes = await Promise.all(
      LALAMOVE_SERVICES.map(async (svc) => {
        const body = JSON.stringify({
          data: {
            serviceType: svc.id,
            language:    'en_MY',
            stops: [
              {
                // Pickup: merchant location
                coordinates: {
                  lat: merchant.lat  ?? '3.1390',   // fallback to KL
                  lng: merchant.lng  ?? '101.6869',
                },
                address: `${merchant.address_line1}, ${merchant.city}, ${merchant.state} ${merchant.postcode}`,
              },
              {
                // Dropoff: customer delivery address
                coordinates: {
                  lat: deliveryAddr.lat ?? '3.1390',
                  lng: deliveryAddr.lng ?? '101.6869',
                },
                address: `${deliveryAddr.line1}${deliveryAddr.line2 ? ', ' + deliveryAddr.line2 : ''}, ${deliveryAddr.city}, ${deliveryAddr.state} ${deliveryAddr.postcode}`,
              },
            ],
          },
        })

        const headers = buildLalamoveHeaders(apiKey, apiSecret, 'POST', path, body)

        try {
          const res  = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body })
          const data = await res.json()

          if (!res.ok) return { serviceType: svc.id, available: false, error: data?.message }

          return {
            serviceType:  svc.id,
            label:        svc.label,
            emoji:        svc.emoji,
            description:  svc.description,
            maxKg:        svc.maxKg,
            available:    true,
            quotationId:  data.data?.quotationId,
            priceBreakdown: data.data?.priceBreakdown,
            totalPrice:   data.data?.priceBreakdown?.total,
            currency:     data.data?.priceBreakdown?.currency ?? 'MYR',
            expiresAt:    data.data?.expiresAt,
          }
        } catch {
          return { serviceType: svc.id, available: false, error: 'Request failed' }
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
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
```


***

## File 3 — `supabase/functions/lalamove-create-order/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildLalamoveHeaders, getLalamoveBaseUrl } from '../_shared/lalamove-auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { orderId, quotationId, serviceType } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: order } = await supabase
      .from('orders')
      .select('*, merchant:merchant_id(store_name, address_line1, city, state, postcode, phone, lat, lng)')
      .eq('id', orderId)
      .single()

    if (!order) throw new Error('Order not found')

    const deliveryAddr = order.delivery_address as any
    const merchant     = order.merchant as any
    const apiKey       = Deno.env.get('LALAMOVE_API_KEY')!
    const apiSecret    = Deno.env.get('LALAMOVE_API_SECRET')!
    const baseUrl      = getLalamoveBaseUrl()
    const path         = '/v3/orders'

    const body = JSON.stringify({
      data: {
        quotationId,
        sender: {
          stopId:   '0',
          name:     merchant.store_name,
          phone:    merchant.phone ?? '+60123456789',
        },
        recipients: [
          {
            stopId:  '1',
            name:    deliveryAddr.name,
            phone:   deliveryAddr.phone,
            remarks: `Order ${order.order_number}`,
          },
        ],
        isPODEnabled: false,
        isRecipientSMSEnabled: true,
      },
    })

    const headers  = buildLalamoveHeaders(apiKey, apiSecret, 'POST', path, body)
    const res      = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body })
    const resData  = await res.json()

    if (!res.ok) throw new Error(resData?.message ?? 'Lalamove booking failed')

    const lalamoveOrderId = resData.data?.orderId

    // Update our order with Lalamove data
    await supabase.from('orders').update({
      status:             'out_for_delivery',
      delivery_provider:  'lalamove',
      delivery_type:      'instant',
      lalamove_order_id:  lalamoveOrderId,
      delivery_quote_id:  quotationId,
    }).eq('id', orderId)

    // Log event
    await supabase.from('delivery_events').insert({
      order_id:    orderId,
      provider:    'lalamove',
      event_type:  'order_created',
      raw_payload: resData.data,
    })

    return new Response(
      JSON.stringify({ success: true, lalamoveOrderId }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
```


***

## File 4 — `supabase/functions/lalamove-webhook/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Deploy: supabase functions deploy lalamove-webhook --no-verify-jwt
serve(async (req) => {
  const body  = await req.json()
  const event = body.data ?? body

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const lalamoveOrderId = event.orderId ?? event.order?.id

  // Find our order by Lalamove order ID
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('lalamove_order_id', lalamoveOrderId)
    .single()

  if (order) {
    await supabase.from('delivery_events').insert({
      order_id:    order.id,
      provider:    'lalamove',
      event_type:  body.eventType ?? 'status_update',
      raw_payload: body,
    })

    // Map Lalamove status to our order status
    const statusMap: Record<string, string> = {
      ASSIGNING_DRIVER: 'out_for_delivery',
      ON_GOING:         'out_for_delivery',
      PICKED_UP:        'out_for_delivery',
      COMPLETED:        'delivered',
      REJECTED:         'preparing',
      CANCELLED:        'preparing',
      EXPIRED:          'preparing',
    }

    const lalamoveStatus = event.status ?? body.status
    const newStatus      = statusMap[lalamoveStatus]

    const updates: any = {}
    if (newStatus) updates.status = newStatus

    // Attach driver info when assigned
    if (event.driverInfo) {
      updates.driver_name  = event.driverInfo.name
      updates.driver_phone = event.driverInfo.phone
      updates.driver_plate = event.driverInfo.plateNumber
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('orders').update(updates).eq('id', order.id)
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```


***

## File 5 — `supabase/functions/easyparcel-rate-check/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// EasyParcel state codes [web:159]
const STATE_CODES: Record<string, string> = {
  'Johor': 'jhr', 'Kedah': 'kd', 'Kelantan': 'ktn', 'Melaka': 'mlk',
  'Negeri Sembilan': 'nsn', 'Pahang': 'phg', 'Perak': 'prk', 'Perlis': 'pls',
  'Pulau Pinang': 'png', 'Sabah': 'sbh', 'Sarawak': 'srw', 'Selangor': 'sgr',
  'Terengganu': 'trg', 'W.P. Kuala Lumpur': 'kul', 'W.P. Labuan': 'lbn',
  'W.P. Putrajaya': 'pjy',
}

function getStateCode(state: string): string {
  return STATE_CODES[state] ?? state.toLowerCase().slice(0, 3)
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

    const apiKey  = Deno.env.get('EASYPARCEL_API_KEY')!
    const isProd  = Deno.env.get('DELIVERY_ENV') === 'production'
    const baseUrl = isProd
      ? 'https://connect.easyparcel.my/?ac=EPRateCheckingBulk'
      : 'https://demo.connect.easyparcel.my/?ac=EPRateCheckingBulk'

    const params = new URLSearchParams({
      api: apiKey,
    })
    // EasyParcel uses form-encoded bulk array [web:159]
    params.append('bulk[^0][pick_code]',    merchant.postcode)
    params.append('bulk[^0][pick_state]',   getStateCode(merchant.state))
    params.append('bulk[^0][pick_country]', 'MY')
    params.append('bulk[^0][send_code]',    deliveryAddr.postcode)
    params.append('bulk[^0][send_state]',   getStateCode(deliveryAddr.state))
    params.append('bulk[^0][send_country]', 'MY')
    params.append('bulk[^0][weight]',       String(totalWeightKg))
    params.append('bulk[^0][parcel_value]', String(order.total_amount))

    const epRes  = await fetch(baseUrl, { method: 'POST', body: params })
    const epData = await epRes.json()

    if (epData.api_status !== 'Success') {
      throw new Error(epData.error_remark ?? 'EasyParcel rate check failed')
    }

    const rates = epData.result?.[^0]?.rates ?? []

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
        serviceDetail:r.service_detail,   // 'dropoff' | 'pickup' | 'dropoff/pickup'
        price:        Number(r.price),
        delivery:     r.delivery,         // '1-2 working day(s)'
        pickupDate:   r.pickup_date,
        weightKg:     totalWeightKg,
      }))

    return new Response(
      JSON.stringify({ rates: cleanRates, weightKg: totalWeightKg }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
```


***

## File 6 — `supabase/functions/easyparcel-create-order/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const STATE_CODES: Record<string, string> = {
  'Johor': 'jhr', 'Kedah': 'kd', 'Kelantan': 'ktn', 'Melaka': 'mlk',
  'Negeri Sembilan': 'nsn', 'Pahang': 'phg', 'Perak': 'prk', 'Perlis': 'pls',
  'Pulau Pinang': 'png', 'Sabah': 'sbh', 'Sarawak': 'srw', 'Selangor': 'sgr',
  'Terengganu': 'trg', 'W.P. Kuala Lumpur': 'kul', 'W.P. Labuan': 'lbn',
  'W.P. Putrajaya': 'pjy',
}
function getStateCode(s: string) { return STATE_CODES[s] ?? s.toLowerCase().slice(0, 3) }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { orderId, serviceId, weightKg } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: order } = await supabase
      .from('orders')
      .select('*, merchant:merchant_id(store_name, address_line1, city, state, postcode, phone)')
      .eq('id', orderId)
      .single()

    if (!order) throw new Error('Order not found')

    const deliveryAddr = order.delivery_address as any
    const merchant     = order.merchant as any
    const apiKey       = Deno.env.get('EASYPARCEL_API_KEY')!
    const isProd       = Deno.env.get('DELIVERY_ENV') === 'production'

    // Step 1: Make Order
    const submitUrl = isProd
      ? 'https://connect.easyparcel.my/?ac=EPSubmitOrderBulk'
      : 'https://demo.connect.easyparcel.my/?ac=EPSubmitOrderBulk'

    const submitParams = new URLSearchParams({ api: apiKey })
    submitParams.append('bulk[^0][weight]',       String(weightKg))
    submitParams.append('bulk[^0][content]',      `Order ${order.order_number}`)
    submitParams.append('bulk[^0][value]',        String(order.total_amount))
    submitParams.append('bulk[^0][service_id]',   serviceId)
    submitParams.append('bulk[^0][pick_name]',    merchant.store_name)
    submitParams.append('bulk[^0][pick_contact]', merchant.phone ?? '0123456789')
    submitParams.append('bulk[^0][pick_addr1]',   merchant.address_line1)
    submitParams.append('bulk[^0][pick_city]',    merchant.city)
    submitParams.append('bulk[^0][pick_state]',   getStateCode(merchant.state))
    submitParams.append('bulk[^0][pick_code]',    merchant.postcode)
    submitParams.append('bulk[^0][pick_country]', 'MY')
    submitParams.append('bulk[^0][send_name]',    deliveryAddr.name)
    submitParams.append('bulk[^0][send_contact]', deliveryAddr.phone)
    submitParams.append('bulk[^0][send_addr1]',   deliveryAddr.line1)
    submitParams.append('bulk[^0][send_addr2]',   deliveryAddr.line2 ?? '')
    submitParams.append('bulk[^0][send_city]',    deliveryAddr.city)
    submitParams.append('bulk[^0][send_state]',   getStateCode(deliveryAddr.state))
    submitParams.append('bulk[^0][send_code]',    deliveryAddr.postcode)
    submitParams.append('bulk[^0][send_country]', 'MY')
    submitParams.append('bulk[^0][collect_date]', new Date().toISOString().slice(0, 10))
    submitParams.append('bulk[^0][sms]',          '0')
    submitParams.append('bulk[^0][send_email]',   'noreply@hyperlocal.app')
    submitParams.append('bulk[^0][reference]',    order.order_number)

    const submitRes  = await fetch(submitUrl, { method: 'POST', body: submitParams })
    const submitData = await submitRes.json()

    if (submitData.api_status !== 'Success' || submitData.result?.[^0]?.status !== 'Success') {
      throw new Error(submitData.result?.[^0]?.remarks ?? submitData.error_remark ?? 'Order submission failed')
    }

    const orderNo = submitData.result[^0].order_number

    // Step 2: Pay Order (deducts from EasyParcel prepaid credit)
    const payUrl    = isProd
      ? 'https://connect.easyparcel.my/?ac=EPPayOrderBulk'
      : 'https://demo.connect.easyparcel.my/?ac=EPPayOrderBulk'
    const payParams = new URLSearchParams({ api: apiKey })
    payParams.append('bulk[^0][order_no]', orderNo)

    const payRes  = await fetch(payUrl, { method: 'POST', body: payParams })
    const payData = await payRes.json()

    const parcel      = payData.result?.[^0]?.parcel?.[^0]
    const awb         = parcel?.awb ?? ''
    const trackingUrl = parcel?.tracking_url ?? ''

    // Update our order with parcel details
    await supabase.from('orders').update({
      status:               'out_for_delivery',
      delivery_provider:    'easyparcel',
      delivery_type:        'courier',
      delivery_service_id:  serviceId,
      easyparcel_order_no:  orderNo,
      tracking_number:      awb,
      tracking_url:         trackingUrl,
    }).eq('id', orderId)

    await supabase.from('delivery_events').insert({
      order_id:    orderId,
      provider:    'easyparcel',
      event_type:  'order_created',
      raw_payload: { submitData: submitData.result, payData: payData.result },
    })

    return new Response(
      JSON.stringify({ success: true, orderNo, awb, trackingUrl }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
```


***

## File 7 — Deploy All Delivery Functions

```bash
supabase functions deploy lalamove-quote
supabase functions deploy lalamove-create-order
supabase functions deploy lalamove-webhook      --no-verify-jwt
supabase functions deploy easyparcel-rate-check
supabase functions deploy easyparcel-create-order
```

Set your Lalamove webhook URL at `partners.lalamove.com` → Webhooks:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/lalamove-webhook
```


***

## File 8 — `src/services/delivery.service.ts`

```typescript
import { supabase } from '@/lib/supabase'

export type LalamoveQuote = {
  serviceType:   string
  label:         string
  emoji:         string
  description:   string
  maxKg:         number
  available:     boolean
  quotationId:   string
  totalPrice:    string
  currency:      string
  expiresAt:     string
}

export type EasyParcelRate = {
  rateId:        string
  serviceId:     string
  courierId:     string
  courierName:   string
  courierLogo:   string
  serviceName:   string
  serviceDetail: string
  price:         number
  delivery:      string
  pickupDate:    string
  weightKg:      number
}

export const deliveryService = {
  getLalamoveQuotes: async (orderId: string): Promise<LalamoveQuote[]> => {
    const { data, error } = await supabase.functions.invoke('lalamove-quote', {
      body: { orderId },
    })
    if (error) throw new Error(error.message)
    return data.quotes ?? []
  },

  bookLalamove: async (orderId: string, quotationId: string, serviceType: string) => {
    const { data, error } = await supabase.functions.invoke('lalamove-create-order', {
      body: { orderId, quotationId, serviceType },
    })
    if (error) throw new Error(error.message)
    return data as { success: boolean; lalamoveOrderId: string }
  },

  getEasyParcelRates: async (orderId: string): Promise<{ rates: EasyParcelRate[]; weightKg: number }> => {
    const { data, error } = await supabase.functions.invoke('easyparcel-rate-check', {
      body: { orderId },
    })
    if (error) throw new Error(error.message)
    return data
  },

  bookEasyParcel: async (orderId: string, serviceId: string, weightKg: number) => {
    const { data, error } = await supabase.functions.invoke('easyparcel-create-order', {
      body: { orderId, serviceId, weightKg },
    })
    if (error) throw new Error(error.message)
    return data as { success: boolean; orderNo: string; awb: string; trackingUrl: string }
  },
}
```


***

## File 9 — `src/components/merchant/DeliveryBookingSheet.tsx`

```typescript
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native'
import { Image } from 'expo-image'
import { useState, useCallback } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { deliveryService, LalamoveQuote, EasyParcelRate } from '@/services/delivery.service'
import { formatCurrency } from '@/lib/utils'
import Toast from 'react-native-toast-message'

type DeliveryTab = 'lalamove' | 'easyparcel'

interface Props {
  visible:   boolean
  orderId:   string
  onClose:   () => void
  onBooked:  () => void
}

// ─── Lalamove option card ──────────────────────────────────────────────────────
function LalamoveCard({
  quote,
  selected,
  onSelect,
}: {
  quote:    LalamoveQuote
  selected: boolean
  onSelect: () => void
}) {
  const priceRM = quote.totalPrice
    ? `RM ${(Number(quote.totalPrice) / 100).toFixed(2)}`
    : '—'

  return (
    <TouchableOpacity
      onPress={onSelect}
      className={`flex-row items-center gap-3 p-3.5 rounded-2xl border-2 mb-2
        ${selected ? 'border-primary-500 bg-primary-50' : 'border-gray-100'}`}
    >
      <Text style={{ fontSize: 28 }}>{quote.emoji}</Text>
      <View className="flex-1">
        <Text className="font-bold text-gray-900 text-sm">{quote.label}</Text>
        <Text className="text-gray-400 text-xs mt-0.5">{quote.description}</Text>
        <Text className="text-gray-400 text-xs">Max {quote.maxKg} kg</Text>
      </View>
      <View className="items-end">
        <Text className="font-bold text-primary-600 text-base">{priceRM}</Text>
        <Text className="text-gray-400 text-xs">~15–45 min</Text>
      </View>
      <View className={`w-5 h-5 rounded-full border-2 ml-1
        ${selected ? 'border-primary-500' : 'border-gray-300'}`}>
        {selected && <View className="flex-1 m-0.5 rounded-full bg-primary-500" />}
      </View>
    </TouchableOpacity>
  )
}

// ─── EasyParcel option card ────────────────────────────────────────────────────
function EasyParcelCard({
  rate,
  selected,
  onSelect,
}: {
  rate:     EasyParcelRate
  selected: boolean
  onSelect: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onSelect}
      className={`flex-row items-center gap-3 p-3.5 rounded-2xl border-2 mb-2
        ${selected ? 'border-primary-500 bg-primary-50' : 'border-gray-100'}`}
    >
      <Image
        source={{ uri: rate.courierLogo }}
        style={{ width: 44, height: 44, borderRadius: 8 }}
        contentFit="contain"
      />
      <View className="flex-1">
        <Text className="font-bold text-gray-900 text-sm" numberOfLines={1}>
          {rate.courierName}
        </Text>
        <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={1}>
          {rate.serviceName}
        </Text>
        <View className="flex-row items-center gap-1 mt-0.5">
          <Ionicons name="time-outline" size={11} color="#9ca3af" />
          <Text className="text-gray-400 text-xs">{rate.delivery}</Text>
          <View className="w-1 h-1 rounded-full bg-gray-300 ml-1" />
          <Text className="text-gray-400 text-xs capitalize">{rate.serviceDetail}</Text>
        </View>
      </View>
      <View className="items-end">
        <Text className="font-bold text-primary-600 text-base">
          {formatCurrency(rate.price)}
        </Text>
        <Text className="text-gray-400 text-xs">{rate.weightKg.toFixed(2)} kg</Text>
      </View>
      <View className={`w-5 h-5 rounded-full border-2 ml-1
        ${selected ? 'border-primary-500' : 'border-gray-300'}`}>
        {selected && <View className="flex-1 m-0.5 rounded-full bg-primary-500" />}
      </View>
    </TouchableOpacity>
  )
}

// ─── Main sheet ────────────────────────────────────────────────────────────────
export function DeliveryBookingSheet({ visible, orderId, onClose, onBooked }: Props) {
  const [activeTab, setActiveTab]     = useState<DeliveryTab>('lalamove')
  const [isLoading, setIsLoading]     = useState(false)
  const [isBooking, setIsBooking]     = useState(false)
  const [lalamoveQuotes, setLalamoveQuotes] = useState<LalamoveQuote[]>([])
  const [epRates, setEpRates]               = useState<EasyParcelRate[]>([])
  const [epWeightKg, setEpWeightKg]         = useState(0)
  const [selectedLalamove, setSelectedLalamove] = useState<LalamoveQuote | null>(null)
  const [selectedEp, setSelectedEp]             = useState<EasyParcelRate | null>(null)
  const [error, setError]             = useState<string | null>(null)

  const loadQuotes = useCallback(async (tab: DeliveryTab) => {
    setIsLoading(true)
    setError(null)
    try {
      if (tab === 'lalamove') {
        const quotes = await deliveryService.getLalamoveQuotes(orderId)
        setLalamoveQuotes(quotes)
      } else {
        const { rates, weightKg } = await deliveryService.getEasyParcelRates(orderId)
        setEpRates(rates)
        setEpWeightKg(weightKg)
      }
    } catch (err: any) {
      setError(err.message)
    }
    setIsLoading(false)
  }, [orderId])

  const handleTabChange = (tab: DeliveryTab) => {
    setActiveTab(tab)
    setSelectedLalamove(null)
    setSelectedEp(null)
    const hasData = tab === 'lalamove' ? lalamoveQuotes.length > 0 : epRates.length > 0
    if (!hasData) loadQuotes(tab)
  }

  const handleOpen = () => {
    if (lalamoveQuotes.length === 0) loadQuotes('lalamove')
  }

  const handleBook = async () => {
    const canBook = activeTab === 'lalamove' ? !!selectedLalamove : !!selectedEp
    if (!canBook) return

    Alert.alert(
      'Confirm booking?',
      activeTab === 'lalamove'
        ? `Book ${selectedLalamove!.label} — RM ${(Number(selectedLalamove!.totalPrice) / 100).toFixed(2)}`
        : `Book ${selectedEp!.courierName} — ${formatCurrency(selectedEp!.price)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Book Now', onPress: doBook },
      ]
    )
  }

  const doBook = async () => {
    setIsBooking(true)
    try {
      if (activeTab === 'lalamove' && selectedLalamove) {
        await deliveryService.bookLalamove(
          orderId,
          selectedLalamove.quotationId,
          selectedLalamove.serviceType
        )
        Toast.show({ type: 'success', text1: 'Lalamove booked!', text2: 'Driver is being assigned.' })
      } else if (activeTab === 'easyparcel' && selectedEp) {
        const result = await deliveryService.bookEasyParcel(orderId, selectedEp.serviceId, epWeightKg)
        Toast.show({ type: 'success', text1: 'Shipment booked!', text2: `AWB: ${result.awb}` })
      }
      onBooked()
      onClose()
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Booking failed', text2: err.message })
    }
    setIsBooking(false)
  }

  const selectedPrice = activeTab === 'lalamove'
    ? (selectedLalamove ? `RM ${(Number(selectedLalamove.totalPrice) / 100).toFixed(2)}` : null)
    : (selectedEp ? formatCurrency(selectedEp.price) : null)

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <Text className="text-xl font-bold text-gray-900">Book Delivery</Text>
          <TouchableOpacity
            onPress={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center"
          >
            <Ionicons name="close" size={18} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* Tab switcher */}
        <View className="flex-row mx-5 mt-4 mb-2 bg-gray-100 rounded-2xl p-1">
          {([
            { key: 'lalamove',   label: '🏍️  Instant',  sub: 'Lalamove' },
            { key: 'easyparcel', label: '📦  Courier',   sub: 'EasyParcel' },
          ] as { key: DeliveryTab; label: string; sub: string }[]).map(tab => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => handleTabChange(tab.key)}
              className={`flex-1 items-center py-2 rounded-xl
                ${activeTab === tab.key ? 'bg-white shadow' : ''}`}
            >
              <Text className={`font-semibold text-sm
                ${activeTab === tab.key ? 'text-gray-900' : 'text-gray-500'}`}>
                {tab.label}
              </Text>
              <Text className={`text-xs
                ${activeTab === tab.key ? 'text-gray-400' : 'text-gray-400'}`}>
                {tab.sub}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center gap-3">
            <ActivityIndicator size="large" color="#2563eb" />
            <Text className="text-gray-400 text-sm">
              {activeTab === 'lalamove' ? 'Getting live rates...' : 'Checking courier rates...'}
            </Text>
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-8 gap-4">
            <Ionicons name="warning-outline" size={40} color="#ef4444" />
            <Text className="text-gray-700 font-semibold text-center">Failed to load rates</Text>
            <Text className="text-gray-400 text-sm text-center">{error}</Text>
            <TouchableOpacity
              onPress={() => loadQuotes(activeTab)}
              className="bg-primary-500 rounded-xl px-5 py-2.5"
            >
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 160 }}>
            {activeTab === 'lalamove' && lalamoveQuotes.length === 0 && (
              <View className="items-center py-12">
                <Text className="text-gray-400 text-sm">No Lalamove services available for this route.</Text>
              </View>
            )}

            {activeTab === 'lalamove' && lalamoveQuotes.map(q => (
              <LalamoveCard
                key={q.serviceType}
                quote={q}
                selected={selectedLalamove?.serviceType === q.serviceType}
                onSelect={() => setSelectedLalamove(q)}
              />
            ))}

            {activeTab === 'easyparcel' && epRates.length === 0 && (
              <View className="items-center py-12">
                <Text className="text-gray-400 text-sm">No courier services available for this route.</Text>
              </View>
            )}

            {activeTab === 'easyparcel' && epRates.map(r => (
              <EasyParcelCard
                key={r.rateId}
                rate={r}
                selected={selectedEp?.rateId === r.rateId}
                onSelect={() => setSelectedEp(r)}
              />
            ))}

            {/* Note about EasyParcel prepaid credit */}
            {activeTab === 'easyparcel' && (
              <View className="bg-amber-50 rounded-xl p-3 mt-2 flex-row gap-2">
                <Ionicons name="information-circle-outline" size={16} color="#d97706" />
                <Text className="text-amber-700 text-xs flex-1 leading-relaxed">
                  EasyParcel booking deducts from your EasyParcel prepaid credit balance.
                  Top up at app.easyparcel.com if booking fails.
                </Text>
              </View>
            )}
          </ScrollView>
        )}

        {/* Sticky CTA */}
        {!isLoading && !error && (
          <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 pt-3 pb-8">
            <TouchableOpacity
              onPress={handleBook}
              disabled={isBooking || (!selectedLalamove && !selectedEp)}
              className="rounded-2xl py-4 items-center flex-row justify-center gap-2"
              style={{
                backgroundColor: (!selectedLalamove && !selectedEp) ? '#e5e7eb' : '#2563eb',
              }}
            >
              {isBooking
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="bicycle-outline" size={20} color={(!selectedLalamove && !selectedEp) ? '#9ca3af' : '#fff'} />
              }
              <Text
                style={{
                  fontWeight: '700',
                  fontSize: 16,
                  color: (!selectedLalamove && !selectedEp) ? '#9ca3af' : '#fff',
                }}
              >
                {isBooking
                  ? 'Booking...'
                  : selectedPrice
                    ? `Book for ${selectedPrice}`
                    : 'Select a delivery option'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  )
}
```


***

## File 10 — Update `app/(merchant)/order/[orderId].tsx` (add delivery section)

Add this block inside your `SectionCard` layout, just before the action buttons, only when order is `confirmed` or `preparing`:

```typescript
// Add at the top of the file
import { DeliveryBookingSheet } from '@/components/merchant/DeliveryBookingSheet'

// Add inside the component
const [deliverySheetOpen, setDeliverySheetOpen] = useState(false)

// Add this section inside <ScrollView>, after the payment SectionCard:
{['confirmed', 'preparing', 'ready_for_pickup'].includes(order.status) && (
  <SectionCard title="🚚  Delivery">
    {order.delivery_provider ? (
      // Already booked
      <View className="gap-2">
        <View className="flex-row justify-between">
          <Text className="text-gray-500 text-sm">Provider</Text>
          <Text className="text-gray-900 font-semibold text-sm capitalize">
            {order.delivery_provider}
          </Text>
        </View>
        {order.tracking_number && (
          <View className="flex-row justify-between">
            <Text className="text-gray-500 text-sm">Tracking</Text>
            <Text className="text-gray-700 font-mono text-xs">{order.tracking_number}</Text>
          </View>
        )}
        {order.driver_name && (
          <View className="flex-row justify-between">
            <Text className="text-gray-500 text-sm">Driver</Text>
            <Text className="text-gray-900 font-semibold text-sm">
              {order.driver_name} · {order.driver_plate}
            </Text>
          </View>
        )}
        {order.tracking_url && (
          <TouchableOpacity
            onPress={() => Linking.openURL(order.tracking_url!)}
            className="flex-row items-center gap-2 mt-1 bg-primary-50 rounded-xl p-3"
          >
            <Ionicons name="open-outline" size={16} color="#2563eb" />
            <Text className="text-primary-600 font-semibold text-sm">Track parcel</Text>
          </TouchableOpacity>
        )}
      </View>
    ) : (
      // Not yet booked
      <View>
        <Text className="text-gray-500 text-sm mb-3">
          Book a delivery service for this order. The fee will be deducted from your
          delivery wallet (Lalamove) or EasyParcel credit balance.
        </Text>
        <TouchableOpacity
          onPress={() => setDeliverySheetOpen(true)}
          className="bg-primary-500 rounded-xl py-3 flex-row items-center justify-center gap-2"
        >
          <Ionicons name="bicycle-outline" size={18} color="#fff" />
          <Text className="text-white font-bold">Book Delivery</Text>
        </TouchableOpacity>
      </View>
    )}
  </SectionCard>
)}

// Add just before closing </View>
<DeliveryBookingSheet
  visible={deliverySheetOpen}
  orderId={orderId}
  onClose={() => setDeliverySheetOpen(false)}
  onBooked={() => {
    setDeliverySheetOpen(false)
    fetchOrder()
  }}
/>
```


***

## Full Verify Checklist

```bash
npx expo start
```

| Test | Expected result |
| :-- | :-- |
| `lalamove-quote` Edge Function | Returns 4 options (motorbike, sedan, van, lorry) with live MYR prices from sandbox [^1] |
| `easyparcel-rate-check` Edge Function | Returns up to 6 courier options (PosLaju, Skynet, DHL, etc.) sorted by price [^2] |
| Merchant taps "Book Delivery" | Sheet slides up, Lalamove tab loads with animated spinner then price cards |
| Switch to EasyParcel tab | Courier logos load, delivery ETA shown, weight auto-calculated from product weights |
| Book Lalamove motorbike | `lalamove-create-order` fires, order status changes to `out_for_delivery`, sheet closes |
| Book EasyParcel Poslaju | `easyparcel-create-order` fires, AWB number saved, tracking URL appears in order detail |
| Driver assigned (Lalamove webhook) | `lalamove-webhook` updates driver name, phone, plate on the order |
| Customer order detail | Tracking URL tappable; opens courier tracking page in browser |
| Booking with no delivery address lat/lng | Falls back to KL coordinates — works for testing, add geocoding in Phase 7 |

<span style="display:none">[^10][^11][^12][^13][^14][^15][^3][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://www.lalamove.com/en-my/business/api-solutions

[^2]: https://developers.easyparcel.com/?pg=Demo\&c=Malaysia\&type=MarketPlace%2F1000

[^3]: https://my.justorder.today/en/docs/integrate-with-lalamove/

[^4]: https://www.ecommerce-pro.my/lalamove-integration

[^5]: https://help.lelong.my/setup-lalamove-integration/

[^6]: https://developers.boxme.asia/doc-1626091

[^7]: https://support.easystore.co/en/article/connect-with-easyparcel-malaysia-hrfknd/

[^8]: https://www.digitalnewsasia.com/business/grabexpress-now-available-klang-valley

[^9]: https://github.com/lalamove/api-examples

[^10]: https://blog.easyparcel.com/my/easyparcel-v3-0/

[^11]: https://www.grab.com/my/express/

[^12]: https://helpcentre-my.easyparcel.com/support/solutions/folders/9000198067

[^13]: https://help.grab.com/merchant/en-my/20000180-GrabExpress-API

[^14]: https://help.grab.com/merchant/en-ph/4404599733273-Understanding-GrabExpress-API

[^15]: https://developers.easyparcel.com

