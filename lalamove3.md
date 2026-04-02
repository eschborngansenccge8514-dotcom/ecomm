<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# What is the issue with this api?

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildLalamoveHeaders, getLalamoveBaseUrl } from './_shared/lalamove-auth.ts'
import { logLalamoveApi } from './_shared/utils.ts'

const CORS = {
'Access-Control-Allow-Origin': '*',
'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ok  = (d: unknown) => new Response(JSON.stringify(d), { headers: { ...CORS, 'Content-Type': 'application/json' } })
const err = (m: string, status = 400) => new Response(JSON.stringify({ error: m }), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// Normalise Malaysian phone numbers to E.164 (+60XXXXXXXXX)
function normPhone(phone: string | null | undefined, fallback = '+60123456789'): string {
if (!phone) return fallback
const trimmed = phone.trim()
if (trimmed.startsWith('+')) return trimmed
if (trimmed.startsWith('60')) return '+' + trimmed
if (trimmed.startsWith('0')) return '+60' + trimmed.slice(1)
return fallback
}

async function fetchWithRetry(url: string, init: RequestInit, maxAttempts = 3): Promise<Response> {
const delays = [0, 1000, 2000]
let lastRes: Response | null = null
for (let i = 0; i < maxAttempts; i++) {
if (delays[i] > 0) await new Promise(r => setTimeout(r, delays[i]))
const res = await fetch(url, init)
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
      .maybeSingle()
    
    
    if (!llConfig) {
      console.warn(`[lalamove-create-order] No Lalamove config for merchant ${order.merchant_id}. Using merchant defaults.`)
    }
    
    
    const apiKey    = Deno.env.get('LALAMOVE_API_KEY')
    const apiSecret = Deno.env.get('LALAMOVE_API_SECRET')
    const market    = Deno.env.get('LALAMOVE_MARKET') || 'MY_KUL'
    const env       = Deno.env.get('DELIVERY_ENV')   || 'sandbox'
    const baseUrl   = getLalamoveBaseUrl(env)
    
    
    if (!apiKey || !apiSecret) {
      return err('Lalamove platform secrets are not configured. Please contact support.')
    }
    
    
    const deliveryAddr = order.delivery_address as any
    const merchant     = order.merchant as any
    const serviceType  = overrideService || order.delivery_service_id || llConfig?.default_service_type || 'MOTORCYCLE'
    
    
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
    
    
    const merchLat = String(llConfig?.pickup_lat || merchant.lat || '3.1486')
    const merchLng = String(llConfig?.pickup_lng || merchant.lng || '101.6942')
    const custLatS = String(custLat || '3.1500')
    const custLngS = String(custLng || '101.7000')
    
    
    const pickupAddress = llConfig?.pickup_address_text ||
      `${merchant.address_line1 ?? ''}, ${merchant.city ?? ''}, ${merchant.state} ${merchant.postcode}, Malaysia`
    
    
    const pickupContactName  = llConfig?.pickup_contact_name || merchant.store_name || 'Merchant'
    const pickupContactPhone = normPhone(llConfig?.pickup_contact_phone || merchant.phone)
    
    
    const quotePath = '/v3/quotations'
    const quoteBody = JSON.stringify({
      data: {
        serviceType, language: 'en_MY',
        stops: [
          { coordinates: { lat: merchLat, lng: merchLng }, address: pickupAddress },
          { coordinates: { lat: custLatS, lng: custLngS }, address: `${deliveryAddr.line1 ?? ''}, ${deliveryAddr.city ?? ''}, ${deliveryAddr.state} ${deliveryAddr.postcode}, Malaysia` },
        ],
        item: { quantity: '1', weight: 'LESS_THAN_3_KG', categories: ['OTHER'] }
      },
    })
    
    
    const quoteHeaders = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', quotePath, quoteBody, market)
    const quoteRes    = await fetchWithRetry(`${baseUrl}${quotePath}`, { method: 'POST', headers: quoteHeaders, body: quoteBody })
    const quoteData   = await quoteRes.json()
    
    
    await logLalamoveApi(supabase, orderId, { endpoint: quotePath, method: 'POST', statusCode: quoteRes.status, requestBody: quoteBody, responseBody: quoteData, attempt: 1 })
    
    
    if (!quoteRes.ok) {
      const msg = quoteData?.message ?? quoteData?.error?.message ?? `Quote failed (${quoteRes.status})`
      return err(`Lalamove quote error: ${msg}`)
    }
    
    
    const freshQuotationId = quoteData.data.quotationId
    const sanitize = (s: string) => (s ?? '').replace(/[^\x00-\x7F]/g, '').substring(0, 50)
    const createPath = '/v3/orders'
    const createBody = JSON.stringify({
      data: {
        quotationId: freshQuotationId,
        sender: { stopId: '0', name: sanitize(pickupContactName), phone: pickupContactPhone },
        recipients: [{ stopId: '1', name: sanitize(deliveryAddr.name || 'Customer'), phone: normPhone(deliveryAddr.phone), remarks: `Order ${order.order_number}`.substring(0, 100) }],
        isPODEnabled: false, isRecipientSMSEnabled: true,
      },
    })
    
    
    const createHeaders = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', createPath, createBody, market)
    const createRes    = await fetchWithRetry(`${baseUrl}${createPath}`, { method: 'POST', headers: createHeaders, body: createBody })
    const createData   = await createRes.json()
    
    
    await logLalamoveApi(supabase, orderId, { endpoint: createPath, method: 'POST', statusCode: createRes.status, requestBody: createBody, responseBody: createData, attempt: 1 })
    
    
    if (!createRes.ok) {
      const msg = createData?.message ?? createData?.error?.message ?? `Booking failed (${createRes.status})`
      return err(`Lalamove booking error: ${msg}`)
    }
    
    
    const lalamoveOrderId = createData.data?.orderId
    
    
    await supabase.from('orders').update({
      status: 'out_for_delivery', delivery_status: 'finding_driver',
      delivery_provider: 'lalamove', delivery_type: 'instant',
      lalamove_order_id: lalamoveOrderId, delivery_quote_id: freshQuotationId,
    }).eq('id', orderId)
    
    
    await supabase.from('delivery_events').insert({
      order_id: orderId, provider: 'lalamove', event_type: 'order_created', raw_payload: createData.data,
    })
    
    
    return ok({ success: true, lalamoveOrderId })
    } catch (e: any) {
console.error('[lalamove-create-order] Unhandled error:', e.message, e.stack)
return err(e.message, 500)
}
})

There are **several bugs** in this Supabase Edge Function, with one being a guaranteed runtime failure. Here's a full breakdown:

***

## 🔴 Critical: Hardcoded `stopId` Will Always Fail

This is the primary bug — the order creation will be **rejected by Lalamove's API every time**:

```typescript
// ❌ WRONG — '0' and '1' are not valid Lalamove stop IDs
sender: { stopId: '0', name: ..., phone: ... },
recipients: [{ stopId: '1', name: ..., ... }],
```

The Lalamove v3 API assigns real UUIDs to each stop in the **quotation response**, and those IDs must be passed back verbatim when creating the order. The fix is to read them from `quoteData`:[^1]

```typescript
// ✅ CORRECT — extract stop IDs from the quotation response
const senderStopId    = quoteData.data.stops[^0].stopId
const recipientStopId = quoteData.data.stops[^1].stopId

// then in createBody:
sender: { stopId: senderStopId, name: ..., phone: ... },
recipients: [{ stopId: recipientStopId, name: ..., ... }],
```


***

## 🟠 Medium: Silent DB Failures After Order Creation

The Supabase `update` and `insert` calls after a successful Lalamove order have no error checking. If either fails, the order stays in the wrong status with no alert:

```typescript
// ❌ Errors silently swallowed
await supabase.from('orders').update({ status: 'out_for_delivery', ... }).eq('id', orderId)
await supabase.from('delivery_events').insert({ ... })

// ✅ Should be:
const { error: updateError } = await supabase.from('orders').update(...).eq('id', orderId)
if (updateError) console.error('[lalamove-create-order] DB update failed:', updateError)
```


***

## 🟠 Medium: `delivery_service_id` Is Likely a Foreign Key, Not a Type String

This line treats a DB relationship ID as if it were a Lalamove service type string:

```typescript
// ❌ order.delivery_service_id is probably an integer/UUID FK, not 'MOTORCYCLE'
const serviceType = overrideService || order.delivery_service_id || llConfig?.default_service_type || 'MOTORCYCLE'
```

If `delivery_service_id` is a number like `3`, Lalamove will reject the quotation. You should resolve it to a string like `'SEDAN'` or `'MOTORCYCLE'` before using it.

***

## 🟡 Minor: Retry Logic Misses `429` Rate Limit

`fetchWithRetry` only retries on `502/503/504` gateway errors, but not on `429 Too Many Requests`, which is common with delivery APIs under load:

```typescript
// ❌ 429 is not retried — falls straight through to return
if (res.status === 502 || res.status === 503 || res.status === 504) { ... }

// ✅ Add 429 with a longer delay
if ([429, 502, 503, 504].includes(res.status)) { ... }
// Also consider making the 429 delay longer (e.g. 3000ms)
```


***

## 🟡 Minor: `attempt: 1` Hardcoded in Both Log Calls

Both `logLalamoveApi` calls after `fetchWithRetry` hardcode `attempt: 1`, even if the function internally retried 3 times. The logs will be misleading:

```typescript
// ❌ Always logs attempt 1 even after retries
await logLalamoveApi(supabase, orderId, { ..., attempt: 1 })
```

Consider having `fetchWithRetry` return the attempt count, or remove the field if it's not tracked accurately.

***

## 🟡 Minor: `normPhone` Fallback Is a Fake Number

If a customer's phone number is missing, the function silently substitutes `'+60123456789'` (a well-known dummy number) and creates a real delivery with it — the driver will call an invalid contact:

```typescript
function normPhone(phone: string | null | undefined, fallback = '+60123456789'): string {
```

A safer approach is to return `null` and **block** the order creation if the customer phone is missing, rather than silently proceeding with a fake number.

***

## Summary Table

| Severity | Issue | Impact |
| :-- | :-- | :-- |
| 🔴 Critical | `stopId: '0'/'1'` hardcoded | Order creation always fails [^1] |
| 🟠 Medium | No error check on DB writes post-order | Inconsistent order state silently |
| 🟠 Medium | `delivery_service_id` used as service type | Quotation rejection if it's a FK |
| 🟡 Minor | `429` not retried | Rate-limit failures not recovered |
| 🟡 Minor | `attempt: 1` hardcoded in logs | Misleading retry logs |
| 🟡 Minor | Fake phone number fallback | Driver gets uncontactable recipient |

<span style="display:none">[^10][^2][^3][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://github.com/foodkit/lalamove-php-api/blob/master/README.md

[^2]: https://www.lalamove.com/en-th/business/api-solutions

[^3]: https://support.easystore.co/en/article/connect-with-lalamove-malaysia-n9m68e/

[^4]: https://www.lalamove.com/ms-my/business/penyelesaian-api

[^5]: https://logistics-docs.shipper.id/docs/lalamove-order

[^6]: https://github.com/foodkit/lalamove-php-api

[^7]: https://www.lalamove.com/hubfs/B2B/Lalamove+API+Testing+Checklist.xlsx

[^8]: https://github.com/foodkit/lalamove-php-api/issues/2

[^9]: https://www.lalamove.com/en-ph/business/api-solutions

[^10]: https://www.lalamove.com/en-hk/blog/bring-delivery-costs-down-with-lalamove-multi-stop-service

