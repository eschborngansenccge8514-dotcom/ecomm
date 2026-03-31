<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# event_message

POST | 401 | [https://dgafjyrittkskxlgswvf.supabase.co/functions/v1/get-delivery-quotes](https://dgafjyrittkskxlgswvf.supabase.co/functions/v1/get-delivery-quotes)
metadata
[
{
"deployment_id": "dgafjyrittkskxlgswvf_139bf0f2-87aa-41fd-a52f-5d29994df627_3",
"execution_id": null,
"execution_time_ms": 86,
"function_id": "139bf0f2-87aa-41fd-a52f-5d29994df627",
"project_ref": "dgafjyrittkskxlgswvf",
"request": [
{
"headers": [
{
"accept": "*/*",
"accept_encoding": "gzip, br",
"connection": "Keep-Alive",
"content_length": "200",
"cookie": null,
"host": "dgafjyrittkskxlgswvf.supabase.co",
"user_agent": "Expo/1017756 CFNetwork/3860.500.83 Darwin/25.4.0",
"x_client_info": "supabase-js-react-native/2.100.1"
}
],
"host": "dgafjyrittkskxlgswvf.supabase.co",
"method": "POST",
"pathname": "/functions/v1/get-delivery-quotes",
"port": null,
"protocol": "https:",
"sb": [
{
"apikey": [],
"auth_user": "6e000e98-113c-4a9e-8e3c-1e8d2b0e0618",
"jwt": [
{
"apikey": [
{
"invalid": null,
"payload": [
{
"algorithm": "HS256",
"expires_at": 2090257108,
"issuer": "supabase",
"key_id": null,
"role": "anon",
"session_id": null,
"signature_prefix": "BUUn6j",
"subject": null
}
]
}
],
"authorization": [
{
"invalid": null,
"payload": [
{
"algorithm": "ES256",
"expires_at": 1774701938,
"issuer": "https://dgafjyrittkskxlgswvf.supabase.co/auth/v1",
"key_id": "3c351066-ac25-4dc1-b46e-478aa59ee291",
"role": "authenticated",
"session_id": "ba90ca0f-dcf8-4435-9810-95ff03508160",
"signature_prefix": "O369U2",
"subject": "6e000e98-113c-4a9e-8e3c-1e8d2b0e0618"
}
]
}
]
}
]
}
],
"search": null,
"url": "https://dgafjyrittkskxlgswvf.supabase.co/functions/v1/get-delivery-quotes"
}
],
"response": [
{
"headers": [
{
"content_length": "56",
"content_type": "application/json",
"date": "Sat, 28 Mar 2026 12:29:57 GMT",
"sb_request_id": null,
"server": "cloudflare",
"vary": "Accept-Encoding",
"x_envoy_upstream_service_time": null,
"x_sb_compute_multiplier": null,
"x_sb_edge_region": "ap-southeast-1",
"x_sb_resource_multiplier": null,
"x_served_by": "supabase-edge-runtime"
}
],
"status_code": 401
}
],
"version": "3"
}
]

The key clue is `"execution_id": null` — **the function never ran at all.** This is not a credentials issue. Supabase returns 401 when a function fails to start, which almost always means the `_shared` import crashed the function at boot before executing a single line.[^1]

***

## The Fix — Inline the auth, remove the shared import

The `_shared` folder import is fragile across deployments. The safest fix is to eliminate it entirely and inline the Lalamove auth directly into the function.

Replace your entire `supabase/functions/get-delivery-quotes/index.ts` with this self-contained version:

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Inlined Lalamove auth (no _shared import) ─────────────────────────────────
async function buildLalamoveHeaders(
  apiKey: string, apiSecret: string,
  method: string, path: string, body = ''
): Promise<HeadersInit> {
  const timestamp = String(Date.now())
  const nonce     = crypto.randomUUID().replace(/-/g, '')
  const rawSig    = `${timestamp}\r\n${nonce}\r\n${method.toUpperCase()}\r\n${path}\r\n\r\n${body}`

  // Use Web Crypto API — available natively in Deno, no imports needed
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig    = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawSig))
  const hex    = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  const token  = `${apiKey}:${timestamp}:${nonce}:${hex}`

  return {
    'Authorization': `hmac ${token}`,
    'Content-Type':  'application/json',
    'Market':        Deno.env.get('LALAMOVE_MARKET') ?? 'MY',
    'Accept':        'application/json',
  }
}

// ── State codes ───────────────────────────────────────────────────────────────
const STATE_CODES: Record<string, string> = {
  'Johor': 'jhr', 'Kedah': 'kd', 'Kelantan': 'ktn', 'Melaka': 'mlk',
  'Negeri Sembilan': 'nsn', 'Pahang': 'phg', 'Perak': 'prk', 'Perlis': 'pls',
  'Pulau Pinang': 'png', 'Sabah': 'sbh', 'Sarawak': 'srw', 'Selangor': 'sgr',
  'Terengganu': 'trg', 'W.P. Kuala Lumpur': 'kul', 'W.P. Labuan': 'lbn',
  'W.P. Putrajaya': 'pjy',
}
const stateCode = (s: string) => STATE_CODES[s] ?? s.toLowerCase().slice(0, 3)

const LALAMOVE_SERVICES = [
  { id: 'MOTORCYCLE', label: 'Motorbike', emoji: '🏍️', maxKg: 10,  description: 'Up to 10 kg · 15–45 min' },
  { id: 'SEDAN',      label: 'Sedan',     emoji: '🚗', maxKg: 200, description: 'Up to 200 kg · 20–60 min' },
  { id: 'VAN',        label: 'Van',       emoji: '🚐', maxKg: 500, description: 'Up to 500 kg · 30–75 min' },
]

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json()
    const { merchantId, deliveryAddress, totalWeightKg, parcelValue } = body

    // ── Validate inputs early so we get a clear error ────────────────────────
    if (!merchantId)                   throw new Error('merchantId is required')
    if (!deliveryAddress?.postcode)    throw new Error('deliveryAddress.postcode is required')
    if (!deliveryAddress?.state)       throw new Error('deliveryAddress.state is required')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: merchant, error: mErr } = await supabase
      .from('merchants')
      .select('address_line1, city, state, postcode, phone, lat, lng')
      .eq('id', merchantId)
      .single()

    if (mErr || !merchant) throw new Error(`Merchant not found: ${mErr?.message}`)
    if (!merchant.postcode) throw new Error('Merchant has no postcode set. Update Store Settings first.')
    if (!merchant.state)    throw new Error('Merchant has no state set. Update Store Settings first.')

    const weightKg   = Math.max(Number(totalWeightKg) || 0.5, 0.1)
    const isProd     = Deno.env.get('DELIVERY_ENV') === 'production'
    const lalaBase   = isProd
      ? 'https://rest.lalamove.com'
      : 'https://rest.sandbox.lalamove.com'
    const lalaPath   = '/v3/quotations'
    const apiKey     = Deno.env.get('LALAMOVE_API_KEY') ?? ''
    const apiSecret  = Deno.env.get('LALAMOVE_API_SECRET') ?? ''

    // ── Lalamove quotes ───────────────────────────────────────────────────────
    const lalamoveQuotes = await Promise.all(
      LALAMOVE_SERVICES.map(async (svc) => {
        try {
          if (!apiKey || !apiSecret) {
            console.warn('Lalamove keys not set, skipping')
            return null
          }
          const bodyStr = JSON.stringify({
            data: {
              serviceType: svc.id,
              language: 'en_MY',
              stops: [
                {
                  coordinates: { lat: merchant.lat ?? '3.1390', lng: merchant.lng ?? '101.6869' },
                  address: `${merchant.address_line1 ?? ''}, ${merchant.city ?? ''}, ${merchant.state} ${merchant.postcode}, Malaysia`,
                },
                {
                  coordinates: { lat: deliveryAddress.lat ?? '3.1390', lng: deliveryAddress.lng ?? '101.6869' },
                  address: `${deliveryAddress.line1 ?? ''}, ${deliveryAddress.city ?? ''}, ${deliveryAddress.state} ${deliveryAddress.postcode}, Malaysia`,
                },
              ],
            },
          })
          const headers = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', lalaPath, bodyStr)
          const res     = await fetch(`${lalaBase}${lalaPath}`, { method: 'POST', headers, body: bodyStr })
          const data    = await res.json()
          if (!res.ok) { console.warn(`Lalamove ${svc.id} failed:`, data?.message); return null }

          return {
            type:        'instant',
            provider:    'lalamove',
            serviceType: svc.id,
            label:       svc.label,
            emoji:       svc.emoji,
            description: svc.description,
            maxKg:       svc.maxKg,
            priceRM:     Number(data.data?.priceBreakdown?.total ?? 0) / 100,
            quotationId: data.data?.quotationId ?? '',
            expiresAt:   data.data?.expiresAt ?? '',
          }
        } catch (e) {
          console.warn(`Lalamove ${svc.id} error:`, e.message)
          return null
        }
      })
    )

    // ── EasyParcel rates ──────────────────────────────────────────────────────
    let courierRates: any[] = []
    try {
      const epKey = Deno.env.get('EASYPARCEL_API_KEY')
      if (!epKey) throw new Error('EASYPARCEL_API_KEY not set')

      const epUrl = isProd
        ? 'https://connect.easyparcel.my/?ac=EPRateCheckingBulk'
        : 'https://demo.connect.easyparcel.my/?ac=EPRateCheckingBulk'

      const epParams = new URLSearchParams({ api: epKey })
      epParams.append('bulk[^0][pick_code]',    merchant.postcode)
      epParams.append('bulk[^0][pick_state]',   stateCode(merchant.state))
      epParams.append('bulk[^0][pick_country]', 'MY')
      epParams.append('bulk[^0][send_code]',    deliveryAddress.postcode)
      epParams.append('bulk[^0][send_state]',   stateCode(deliveryAddress.state))
      epParams.append('bulk[^0][send_country]', 'MY')
      epParams.append('bulk[^0][weight]',       String(weightKg))
      epParams.append('bulk[^0][parcel_value]', String(parcelValue ?? 10))

      const controller = new AbortController()
      const timer      = setTimeout(() => controller.abort(), 8000)
      const epRes      = await fetch(epUrl, { method: 'POST', body: epParams, signal: controller.signal })
      clearTimeout(timer)
      const epData = await epRes.json()

      if (epData.api_status === 'Success') {
        courierRates = (epData.result?.[^0]?.rates ?? []).slice(0, 5).map((r: any) => ({
          type:          'courier',
          provider:      'easyparcel',
          serviceId:     r.service_id,
          rateId:        r.rate_id,
          courierName:   r.courier_name,
          courierLogo:   r.courier_logo,
          serviceName:   r.service_name,
          serviceDetail: r.service_detail,
          priceRM:       Number(r.price),
          delivery:      r.delivery,
          weightKg,
        }))
      } else {
        console.warn('EasyParcel non-success:', epData.error_remark)
      }
    } catch (epErr) {
      console.warn('EasyParcel failed (non-fatal):', epErr.message)
    }

    return new Response(
      JSON.stringify({
        instant:    lalamoveQuotes.filter(Boolean),
        courier:    courierRates,
        selfPickup: {
          type: 'self_pickup', provider: 'self',
          label: 'Self Pickup', emoji: '🏃',
          description: 'Collect at the store yourself',
          priceRM: 0,
        },
        weightKg,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('get-delivery-quotes fatal error:', err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
```


***

## Do the same for the other functions that use `_shared`

These three also import from `_shared` and will fail the same way:

```bash
# For each of these, replace the import at the top with the
# inlined buildLalamoveHeaders function above, then redeploy:
supabase/functions/lalamove-quote/index.ts
supabase/functions/lalamove-create-order/index.ts
```

Simply cut the import line:

```typescript
// DELETE this line from those files:
import { buildLalamoveHeaders, getLalamoveBaseUrl } from '../_shared/lalamove-auth.ts'
```

And paste the `buildLalamoveHeaders` async function + `getLalamoveBaseUrl` inline at the top of each file.

***

## Redeploy and verify

```bash
supabase functions deploy get-delivery-quotes
supabase functions deploy lalamove-quote
supabase functions deploy lalamove-create-order
```

Then watch logs live while you test in the app:[^2]

```bash
supabase functions logs get-delivery-quotes --tail
```

You'll now see proper `console.warn` and `console.error` output with the exact line that fails. The `execution_id` will no longer be `null` once the import crash is fixed.

<div align="center">⁂</div>

[^1]: https://supabase.com/docs/guides/functions/troubleshooting

[^2]: https://supabase.com/docs/guides/functions/logging

