import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callEasyParcel } from '../_shared/easyparcel.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Malaysia state centre coordinates ────────────────────────────────────────
const STATE_COORDS: Record<string, { lat: string; lng: string }> = {
  'Johor':              { lat: '1.9344',   lng: '103.3587' },
  'Kedah':              { lat: '6.1184',   lng: '100.3685' },
  'Kelantan':           { lat: '6.1254',   lng: '102.2381' },
  'Melaka':             { lat: '2.1896',   lng: '102.2501' },
  'Negeri Sembilan':    { lat: '2.7258',   lng: '101.9424' },
  'Pahang':             { lat: '3.8126',   lng: '103.3256' },
  'Perak':              { lat: '4.5921',   lng: '101.0901' },
  'Perlis':             { lat: '6.4449',   lng: '100.2048' },
  'Pulau Pinang':       { lat: '5.4141',   lng: '100.3288' },
  'Sabah':              { lat: '5.9788',   lng: '116.0753' },
  'Sarawak':            { lat: '1.5535',   lng: '110.3592' },
  'Selangor':           { lat: '3.0738',   lng: '101.5183' },
  'Terengganu':         { lat: '5.3117',   lng: '103.1324' },
  'W.P. Kuala Lumpur':  { lat: '3.1390',   lng: '101.6869' },
  'W.P. Labuan':        { lat: '5.2831',   lng: '115.2308' },
  'W.P. Putrajaya':     { lat: '2.9264',   lng: '101.6964' },
}

const STATE_CODES: Record<string, string> = {
  'johor': 'jhr', 'kedah': 'kdh', 'kelantan': 'ktn', 'melaka': 'mlk',
  'negeri sembilan': 'nsn', 'pahang': 'phg', 'perak': 'prk', 'perlis': 'pls',
  'pulau pinang': 'png', 'penang': 'png',
  'sabah': 'sbh', 'sarawak': 'swk', 'selangor': 'sgr', 'terengganu': 'trg',
  'w.p. kuala lumpur': 'kul', 'kuala lumpur': 'kul', 'kl': 'kul',
  'w.p. labuan': 'lbn', 'labuan': 'lbn',
  'w.p. putrajaya': 'pjy', 'putrajaya': 'pjy',
}

function stateCode(s: string): string {
  if (!s) return ''
  const clean = s.toLowerCase().trim()
  return STATE_CODES[clean] ?? clean.replace(/\s+/g, '').slice(0, 3)
}

function coordsForState(state: string): { lat: string; lng: string } {
  return STATE_COORDS[state] ?? { lat: '3.1390', lng: '101.6869' }
}

async function hmacSHA256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function lalamoveHeaders(
  apiKey: string, apiSecret: string,
  method: string, path: string, body: string
): Promise<HeadersInit> {
  const ts  = String(Date.now())
  const raw = `${ts}\r\n${method}\r\n${path}\r\n\r\n${body}`
  const hex = await hmacSHA256(apiSecret, raw)
  return {
    'Authorization': `hmac ${apiKey}:${ts}:${hex}`,
    'Content-Type':  'application/json',
    'Market':        'MY',
    'Accept':        'application/json',
  }
}

const LALA_SERVICES = [
  { id: 'MOTORCYCLE', label: 'Motorbike', emoji: '🏍️', maxKg: 10,  desc: 'Up to 10 kg · 15–45 min' },
  { id: 'CAR',        label: 'Car',       emoji: '🚗', maxKg: 200, desc: 'Up to 200 kg · 20–60 min' },
  { id: 'VAN',        label: 'Van',       emoji: '🚐', maxKg: 500, desc: 'Up to 500 kg · 30–75 min' },
]

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const ok  = (data: unknown) => new Response(JSON.stringify(data),        { headers: { ...CORS, 'Content-Type': 'application/json' } })
  const err = (msg: string)   => new Response(JSON.stringify({ error: msg }), { headers: { ...CORS, 'Content-Type': 'application/json' } })

  let body: any
  try { body = await req.json() } catch { return err('Invalid JSON body') }

  const { merchantId, deliveryAddress, totalWeightKg, parcelValue, mode } = body ?? {}

  // --- OPTIMIZATION: Immediate return for hardcoded courier quotes ---
  // This bypasses all DB lookups and API calls for customer checkout
  if (mode === 'customer' || mode === 'courier' || (!mode && deliveryAddress?.postcode)) {
    return ok({
      instant: [],
      courier: [{
        type: 'courier', 
        provider: 'easyparcel',
        serviceId: 'standard-delivery', 
        rateId: 'hardcoded',
        courierName: 'Standard Delivery', 
        courierLogo: 'https://pic.easyparcel.my/my/web/v2/easyparcel_logo.png', 
        serviceName: 'Standard Courier Delivery', 
        serviceDetail: 'pickup',
        priceRM: 8.00,
        delivery: '2 - 3 Working Days', 
        weightKg: Math.max(Number(totalWeightKg) || 0.5, 0.1),
      }],
      selfPickup: {
        type: 'self_pickup', provider: 'self',
        label: 'Self Pickup', emoji: '🏃',
        description: 'Collect at the store yourself',
        priceRM: 0,
      },
      weightKg: Math.max(Number(totalWeightKg) || 0.5, 0.1),
      _debug: { hardcoded: true, mode }
    })
  }

  if (!merchantId)                return err('merchantId is required')
  if (!deliveryAddress?.postcode) return err('deliveryAddress.postcode is required')
  if (!deliveryAddress?.state)    return err('deliveryAddress.state is required')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: merchant, error: mErr } = await supabase
    .from('merchants')
    .select('address_line1, city, state, postcode, phone, lat, lng')
    .eq('id', merchantId)
    .single()

  if (mErr || !merchant) return err(`Merchant not found: ${mErr?.message ?? 'no row'}`)
  if (!merchant.postcode) return err('Merchant postcode missing — update Store Settings')
  if (!merchant.state)    return err('Merchant state missing — update Store Settings')

  // Use stored merchant coords → fall back to state centre
  const merchantCoords = (merchant.lat && merchant.lng)
    ? { lat: String(merchant.lat), lng: String(merchant.lng) }
    : coordsForState(merchant.state)

  // Fetch customer address lat/lng natively or from DB if ID is provided
  let customerCoords = coordsForState(deliveryAddress.state)

  if (deliveryAddress.lat && deliveryAddress.lng) {
    customerCoords = { lat: String(deliveryAddress.lat), lng: String(deliveryAddress.lng) }
  } else if (deliveryAddress.id) {
    const { data: addrRow } = await supabase
      .from('addresses')
      .select('lat, lng')
      .eq('id', deliveryAddress.id)
      .single()
    if (addrRow?.lat && addrRow?.lng) {
      customerCoords = { lat: String(addrRow.lat), lng: String(addrRow.lng) }
    }
  }

  const weightKg = Math.max(Number(totalWeightKg) || 0.5, 0.1)
  const isProd    = Deno.env.get('DELIVERY_ENV') === 'production'
  const lalaBase  = isProd ? 'https://rest.lalamove.com' : 'https://rest.sandbox.lalamove.com'
  const lalaPath  = '/v3/quotations'
  const lalaKey   = Deno.env.get('LALAMOVE_API_KEY')   ?? ''
  const lalaSec   = Deno.env.get('LALAMOVE_API_SECRET') ?? ''
  const epKey     = Deno.env.get('EASYPARCEL_API_KEY')  ?? ''

  const runInstant = !mode || mode === 'all' || mode === 'instant'
  const runCourier = !mode || mode === 'all' || mode === 'courier' || mode === 'merchant'

  // ── Parallel fetching ──────────────────────────────────────────────────────
  let lalamoveQuotes: any[] = []
  let courierRates: any[] = []
  let _lalaDebug: any[] = []
  let _epDebug: any = { modeReceived: mode }
  
  console.log(`[get-delivery-quotes] Mode: ${mode}, Merchant: ${merchantId}`)

  const lalaPromise = (async () => {
    if (!runInstant || !lalaKey || !lalaSec) return
    lalamoveQuotes = await Promise.all(
      LALA_SERVICES.map(async (svc) => {
        try {
          const reqBody = JSON.stringify({
            data: {
              serviceType: svc.id,
              language: 'en_MY',
              stops: [
                {
                  coordinates: merchantCoords,
                  address: `${merchant.address_line1 ?? ''}, ${merchant.city ?? ''}, ${merchant.state} ${merchant.postcode}, Malaysia`,
                },
                {
                  coordinates: customerCoords,
                  address: `${deliveryAddress.line1 ?? ''}, ${deliveryAddress.city ?? ''}, ${deliveryAddress.state} ${deliveryAddress.postcode}, Malaysia`,
                },
              ],
              // Note: 'item' block is REMOVED to avoid 502 errors in Malaysia sandbox
            },
          })
          const hdrs = await lalamoveHeaders(lalaKey, lalaSec, 'POST', lalaPath, reqBody)
          const res  = await fetch(`${lalaBase}${lalaPath}`, { method: 'POST', headers: hdrs, body: reqBody })
          const data = await res.json()
          if (!res.ok) { 
            _lalaDebug.push({ svc: svc.id, error: data?.message || res.statusText })
            return null 
          }
          return {
            type: 'instant', provider: 'lalamove',
            serviceType: svc.id, label: svc.label,
            emoji: svc.emoji, description: svc.desc,
            maxKg: svc.maxKg,
            priceRM:     Number(data.data?.priceBreakdown?.total ?? 0),
            quotationId: data.data?.quotationId ?? '',
            expiresAt:   data.data?.expiresAt   ?? '',
          }
        } catch (e: any) { 
          _lalaDebug.push({ svc: svc.id, error: e.message })
          return null 
        }
      })
    )
  })()

  const epPromise = (async () => {
    if (!runCourier) return
    
    // --- NEW: For customers, we now HARDCODE the price to avoid API delays/failures ---
    // We hardcode for 'customer', 'courier' (default for app), 'all' or no mode.
    // 'merchant' mode is reserved for real-time rates in the dashboard.
    if (mode === 'customer' || mode === 'courier' || !mode || mode === 'all') {
      _epDebug.mode = 'customer_hardcoded'
      courierRates = [{
        type: 'courier', 
        provider: 'easyparcel',
        serviceId: 'standard-delivery', 
        rateId: 'hardcoded',
        courierName: 'Standard Delivery', 
        courierLogo: 'https://pic.easyparcel.my/my/web/v2/easyparcel_logo.png', 
        serviceName: 'Standard Courier Delivery', 
        serviceDetail: 'pickup',
        priceRM: 8.00, // Hardcoded value
        delivery: '2 - 3 Working Days', 
        weightKg,
      }]
      
      // If we are in 'all' mode, we still want to try to get Lalamove quotes in parallel, 
      // but for Courier, we just return the hardcoded one immediately.
      if (mode !== 'all') return 
    }

    try {
      // 1. Fetch merchant config for possible custom keys
      const { data: epConfig } = await supabase
        .from('merchant_easyparcel_config')
        .select('*')
        .eq('merchant_id', merchantId)
        .single()

      const epCallConfig = { 
        apiKey:      epConfig?.api_key || Deno.env.get('EASYPARCEL_API_KEY'), 
        environment: epConfig?.environment || 'sandbox' 
      }

      const weightKgStr = Math.max(Number(weightKg || 0.5), 0.1).toFixed(1)
      
      const rateData = await callEasyParcel(supabase, null, 'MPRateCheckingBulk', {
        bulk: [{
          pick_code:    epConfig?.sender_postcode || merchant.postcode,
          pick_state:   epConfig?.sender_state || stateCode(merchant.state),
          pick_country: epConfig?.sender_country || 'MY',
          send_code:    deliveryAddress.postcode,
          send_state:   stateCode(deliveryAddress.state),
          send_country: 'MY',
          weight:       weightKgStr,
          parcel_value: String(parcelValue ?? 10)
        }],
        exclude_fields: [
          'rates.*.dropoff_point',
          'rates.*.pickup_point',
          'pgeon_point'
        ]
      }, epCallConfig)

      _epDebug = { 
        ..._epDebug,
        api_status: rateData.api_status, 
        weight: weightKgStr,
        collectionType: epConfig?.collection_type || 'pickup'
      }

      if (rateData.api_status === 'Success') {
        const rates = rateData.result?.[0]?.rates || []
        const collectionType = _epDebug.collectionType
        _epDebug.rawRates = rates.length

        const filteredRates = rates.filter((r: any) => 
          r.service_detail === collectionType || 
          (collectionType === 'pickup' && r.service_detail === 'pickup') ||
          (collectionType === 'dropoff' && r.service_detail === 'dropoff')
        )

        _epDebug.filteredRates = filteredRates.length
        const finalRates = filteredRates.length > 0 ? filteredRates : rates
        _epDebug.finalCount = finalRates.length
        
        // For merchants, return the FULL list
        if (mode === 'merchant') {
          _epDebug.mappingMode = 'merchant'
          courierRates = finalRates.map((r: any) => ({
            type: 'courier', 
            provider: 'easyparcel',
            serviceId: r.service_id || String(r.sid || r.rate_id || Math.random()), 
            rateId: r.rate_id,
            courierName: r.courier_name, 
            courierLogo: r.courier_logo,
            serviceName: r.service_name, 
            serviceDetail: r.service_detail,
            priceRM: Number(r.price) || 0,
            delivery: r.delivery, 
            weightKg,
          }))

          // Add a fallback if list is still empty
          if (courierRates.length === 0) {
            courierRates.push({
              type: 'courier', provider: 'easyparcel',
              serviceId: 'standard-delivery', rateId: 'fallback',
              courierName: 'Standard Delivery', courierLogo: 'https://pic.easyparcel.my/my/web/v2/easyparcel_logo.png',
              serviceName: 'Fallback Service', serviceDetail: 'pickup',
              priceRM: 8.00, delivery: '2-4 Days', weightKg
            })
          }
        }
      } else {
        _epDebug.error = rateData.error_remark || rateData.error_message || 'API Unsuccessful'
      }
    } catch (e: any) { 
      console.warn('EasyParcel non-fatal:', e.message)
      _epDebug.error = e.message
    }

    // MERCHANT FALLBACK: If we still have no rates for a merchant after an error, provide one
    if (mode === 'merchant' && courierRates.length === 0) {
      courierRates = [{
        type: 'courier', provider: 'easyparcel',
        serviceId: 'standard-delivery', rateId: 'fallback',
        courierName: 'Standard Delivery', courierLogo: 'https://pic.easyparcel.my/my/web/v2/easyparcel_logo.png',
        serviceName: 'Fallback Service (Fixed Rate)', serviceDetail: 'pickup',
        priceRM: 8.00, delivery: '2-4 Days', weightKg
      }]
    }
  })()

  await Promise.all([lalaPromise, epPromise])

  return ok({
    instant:    lalamoveQuotes.filter(Boolean),
    courier:    courierRates,
    selfPickup: {
      type: 'self_pickup', provider: 'self',
      label: 'Self Pickup', emoji: '🏃',
      description: 'Collect at the store yourself',
      priceRM: 0,
    },
    weightKg,
    _debug: { lalamove: _lalaDebug, easyparcel: _epDebug }
  })
})
