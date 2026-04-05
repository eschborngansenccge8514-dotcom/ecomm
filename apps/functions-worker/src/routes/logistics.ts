import { Hono } from 'hono'
import { getSupabaseClient, Bindings } from '../lib/supabase'
import { buildLalamoveHeaders, getLalamoveBaseUrl } from '../lib/lalamove'
import { callEasyParcel, getStateCode } from '../lib/easyparcel'
import { fetchWithRetry } from '../lib/utils'

const logistics = new Hono<{ Bindings: Bindings }>()

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

function coordsForState(state: string): { lat: string; lng: string } {
  return STATE_COORDS[state] ?? { lat: '3.1390', lng: '101.6869' }
}

const LALA_SERVICES = [
  { id: 'MOTORCYCLE', label: 'Motorbike',   emoji: '🏍️', maxKg: 10,  desc: 'Up to 10 kg · 15–45 min' },
  { id: 'CAR',        label: 'Car',         emoji: '🚗', maxKg: 200, desc: 'Up to 200 kg · 20–60 min' },
  { id: 'VAN',        label: 'Van',         emoji: '🚐', maxKg: 500, desc: 'Up to 500 kg · 30–75 min' },
  { id: 'LARGEVAN',   label: 'Large Van',   emoji: '🚑', maxKg: 800, desc: 'Up to 800 kg · 45–90 min' },
]

logistics.post('/get-delivery-quotes', async (c) => {
  const body = await c.req.json()
  const { merchantId, deliveryAddress, totalWeightKg, parcelValue, mode } = body ?? {}
  const supabase = getSupabaseClient(c.env)

  const ok = (data: any) => c.json(data)
  const err = (msg: string) => c.json({ error: msg }, 400)

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

  if (!merchantId) return err('merchantId is required')
  if (!deliveryAddress?.postcode) return err('deliveryAddress.postcode is required')
  if (!deliveryAddress?.state) return err('deliveryAddress.state is required')

  const { data: merchant, error: mErr } = await supabase
    .from('merchants')
    .select('address_line1, city, state, postcode, phone, lat, lng')
    .eq('id', merchantId)
    .single()

  if (mErr || !merchant) return err(`Merchant not found: ${mErr?.message ?? 'no row'}`)

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
  const lalaKey = c.env.LALAMOVE_API_KEY ?? ''
  const lalaSec = c.env.LALAMOVE_API_SECRET ?? ''
  const lalaEnv = c.env.LALAMOVE_SANDBOX === 'true' ? 'sandbox' : 'production'
  const lalaBase = getLalamoveBaseUrl(lalaEnv)
  const lalaPath = '/v3/quotations'

  const runInstant = !mode || mode === 'all' || mode === 'instant'
  const runCourier = !mode || mode === 'all' || mode === 'courier' || mode === 'merchant'

  let lalamoveQuotes: any[] = []
  let courierRates: any[] = []
  let _lalaDebug: any[] = []
  let _epDebug: any = { modeReceived: mode }

  const lalaPromise = (async () => {
    if (!runInstant || !lalaKey || !lalaSec) return
    const results = await Promise.all(
      LALA_SERVICES.map(async (svc) => {
        try {
          const body = JSON.stringify({
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
            },
          })
          const headers = await buildLalamoveHeaders(lalaKey, lalaSec, 'POST', lalaPath, body, 'MY')
          const { res } = await fetchWithRetry(`${lalaBase}${lalaPath}`, { method: 'POST', headers, body })
          const data = (await res.json()) as any
          if (!res.ok) {
            const errDetail = data?.errors?.[0]?.message || data?.message || JSON.stringify(data).slice(0, 200) || res.statusText
            _lalaDebug.push({ svc: svc.id, status: res.status, error: errDetail, raw: data })
            return null
          }
          return {
            type: 'instant', provider: 'lalamove',
            serviceType: svc.id, label: svc.label,
            emoji: svc.emoji, description: svc.desc,
            maxKg: svc.maxKg,
            priceRM: Number(data.data?.priceBreakdown?.total ?? 0),
            quotationId: data.data?.quotationId ?? '',
            expiresAt: data.data?.expiresAt ?? '',
          }
        } catch (e: any) {
          _lalaDebug.push({ svc: svc.id, error: e.message })
          return null
        }
      })
    )
    lalamoveQuotes = results.filter(Boolean)
    if (runInstant && lalamoveQuotes.length === 0 && _lalaDebug.length > 0) {
      // If none succeeded, return the first error found
      _epDebug.lalaError = _lalaDebug[0].error
    }
  })()

  const epPromise = (async () => {
    if (!runCourier) return
    
    // EasyParcel hardcoded logic for simplicity (matches original)
    if (mode === 'customer' || mode === 'courier' || !mode || mode === 'all') {
      courierRates = [{
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
        weightKg,
      }]
      if (mode !== 'all') return 
    }

    try {
      const { data: epConfig } = await supabase
        .from('merchant_easyparcel_config')
        .select('*')
        .eq('merchant_id', merchantId)
        .single()

      const epCallConfig = { 
        apiKey: epConfig?.api_key || c.env.EASYPARCEL_API_KEY, 
        authKey: c.env.EASYPARCEL_AUTH_KEY || '', // Assuming this exists in env
        environment: epConfig?.environment || 'sandbox' 
      }

      if (!epCallConfig.apiKey) return

      const rateData = await callEasyParcel(supabase, null, 'MPRateCheckingBulk', {
        bulk: [{
          pick_code: epConfig?.sender_postcode || merchant.postcode,
          pick_state: epConfig?.sender_state || getStateCode(merchant.state),
          pick_country: epConfig?.sender_country || 'MY',
          send_code: deliveryAddress.postcode,
          send_state: getStateCode(deliveryAddress.state),
          send_country: 'MY',
          weight: weightKg.toFixed(1),
          parcel_value: String(parcelValue ?? 10)
        }],
        exclude_fields: [
          'rates.*.dropoff_point',
          'rates.*.pickup_point',
          'pgeon_point'
        ]
      }, epCallConfig)

      if (rateData.api_status === 'Success') {
        const rates = rateData.result?.[0]?.rates || []
        courierRates = rates.map((r: any) => ({
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
      }
    } catch (e: any) {
      _epDebug.error = e.message
    }

    if (courierRates.length === 0) {
      courierRates = [{
        type: 'courier', provider: 'easyparcel',
        serviceId: 'standard-delivery', rateId: 'fallback',
        courierName: 'Standard Delivery', courierLogo: 'https://pic.easyparcel.my/my/web/v2/easyparcel_logo.png',
        serviceName: 'Fallback Service', serviceDetail: 'pickup',
        priceRM: 8.00, delivery: '2-4 Days', weightKg
      }]
    }
  })()

  await Promise.all([lalaPromise, epPromise])

  return ok({
    instant: lalamoveQuotes,
    courier: courierRates,
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

export default logistics
