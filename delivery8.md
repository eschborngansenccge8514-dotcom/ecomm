<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Use Geocode API to get lon lat

Here's the full geocoding implementation — addresses are geocoded **once on save** and stored permanently, so the delivery quote function never needs to geocode at runtime.[^1]

***

## Strategy

```
Address saved → geocode immediately → store lat/lng in DB
                                              ↓
get-delivery-quotes → reads stored lat/lng directly (no geocoding at runtime)
```

This is cheaper, faster, and more reliable than geocoding every time delivery rates are fetched.[^2]

***

## Step 1 — Get a Google Maps API Key

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → **APIs \& Services → Enable APIs**
3. Enable **Geocoding API**
4. **Credentials → Create API Key** → restrict it to "Geocoding API" only

Then set the secret:

```bash
supabase secrets set GOOGLE_MAPS_API_KEY=AIzaSy_YOUR_KEY_HERE
```


***

## Step 2 — Shared geocoding utility (inline, no `_shared` import)

This function goes directly inside every file that needs it. Copy it once:

```typescript
// Paste this at the top of any file that needs geocoding
async function geocodeAddress(address: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=my&key=${apiKey}`
    const res  = await fetch(url)
    const data = await res.json()
    if (data.status !== 'OK' || !data.results?.[^0]) {
      console.warn('Geocode failed:', data.status, address)
      return null
    }
    const { lat, lng } = data.results[^0].geometry.location
    return { lat, lng }
  } catch (e) {
    console.warn('Geocode error:', e.message)
    return null
  }
}
```


***

## Step 3 — New Edge Function: `supabase/functions/geocode-address/index.ts`

Called from the **app** whenever an address is saved. Stores `lat`/`lng` back into the DB immediately.

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ok  = (d: unknown) => new Response(JSON.stringify(d),           { headers: { ...CORS, 'Content-Type': 'application/json' } })
const err = (m: string)  => new Response(JSON.stringify({ error: m }), { headers: { ...CORS, 'Content-Type': 'application/json' } })

async function geocode(address: string, apiKey: string) {
  const url  = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=my&key=${apiKey}`
  const res  = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK' || !data.results?.[^0]) return null
  const { lat, lng } = data.results[^0].geometry.location
  return { lat: Number(lat), lng: Number(lng) }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const body = await req.json().catch(() => null)
  if (!body) return err('Invalid JSON')

  // Supports two target types: 'address' (customer) or 'merchant'
  const { type, id, addressString } = body
  // type:          'address' | 'merchant'
  // id:            uuid of the row to update
  // addressString: full address as a string to geocode

  if (!type || !id || !addressString) return err('type, id and addressString are required')

  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
  if (!apiKey) return err('GOOGLE_MAPS_API_KEY not set')

  const coords = await geocode(addressString, apiKey)
  if (!coords) return err(`Could not geocode: "${addressString}"`)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  if (type === 'merchant') {
    const { error: uErr } = await supabase
      .from('merchants')
      .update({ lat: coords.lat, lng: coords.lng })
      .eq('id', id)
    if (uErr) return err(`DB update failed: ${uErr.message}`)
  }

  if (type === 'address') {
    const { error: uErr } = await supabase
      .from('addresses')
      .update({ lat: coords.lat, lng: coords.lng })
      .eq('id', id)
    if (uErr) return err(`DB update failed: ${uErr.message}`)
  }

  console.log(`Geocoded [${type}:${id}] → ${coords.lat}, ${coords.lng}`)
  return ok({ lat: coords.lat, lng: coords.lng })
})
```

Deploy:

```bash
supabase functions deploy geocode-address
```


***

## Step 4 — Add `lat`/`lng` columns to both tables

Run in Supabase SQL Editor:

```sql
-- Merchants table already had lat/lng from our migration, just verify:
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS lat  double precision,
  ADD COLUMN IF NOT EXISTS lng  double precision;

-- Addresses table needs it too
ALTER TABLE addresses
  ADD COLUMN IF NOT EXISTS lat  double precision,
  ADD COLUMN IF NOT EXISTS lng  double precision;
```


***

## Step 5 — `src/services/geocoding.service.ts`

```typescript
import { supabase } from '@/lib/supabase'

function buildAddressString(parts: {
  line1: string; line2?: string | null
  city: string; state: string; postcode: string
  country?: string
}): string {
  return [
    parts.line1,
    parts.line2,
    parts.city,
    parts.state,
    parts.postcode,
    parts.country ?? 'Malaysia',
  ].filter(Boolean).join(', ')
}

export const geocodingService = {
  // Geocode a customer address row and store lat/lng back into DB
  geocodeAddress: async (addressId: string, address: {
    address_line1: string; address_line2?: string | null
    city: string; state: string; postcode: string
  }): Promise<{ lat: number; lng: number } | null> => {
    const addressString = buildAddressString({
      line1:   address.address_line1,
      line2:   address.address_line2,
      city:    address.city,
      state:   address.state,
      postcode: address.postcode,
    })
    const { data, error } = await supabase.functions.invoke('geocode-address', {
      body: { type: 'address', id: addressId, addressString },
    })
    if (error || data?.error) {
      console.warn('Geocode address failed:', error?.message ?? data?.error)
      return null
    }
    return data
  },

  // Geocode a merchant store address and store lat/lng back into DB
  geocodeMerchant: async (merchantId: string, address: {
    address_line1: string; city: string; state: string; postcode: string
  }): Promise<{ lat: number; lng: number } | null> => {
    const addressString = buildAddressString({
      line1:    address.address_line1,
      city:     address.city,
      state:    address.state,
      postcode: address.postcode,
    })
    const { data, error } = await supabase.functions.invoke('geocode-address', {
      body: { type: 'merchant', id: merchantId, addressString },
    })
    if (error || data?.error) {
      console.warn('Geocode merchant failed:', error?.message ?? data?.error)
      return null
    }
    return data
  },

  buildAddressString,
}
```


***

## Step 6 — Geocode on merchant Store Settings save

Update `app/(merchant)/store-settings.tsx` — add geocoding after the save succeeds:

```typescript
// Add import at top
import { geocodingService } from '@/services/geocoding.service'

// In onSubmit, after merchantsService.update() succeeds:
const onSubmit = async (data: FormData) => {
  if (!merchant) return
  setIsSaving(true)
  try {
    let logoUrl   = merchant.logo_url   ?? null
    let bannerUrl = merchant.banner_url ?? null
    if (newLogo)   logoUrl   = await uploadService.uploadImage('merchant-assets', merchant.id, newLogo,   'logo.jpg')
    if (newBanner) bannerUrl = await uploadService.uploadImage('merchant-assets', merchant.id, newBanner, 'banner.jpg')

    await merchantsService.update(merchant.id, { ...data, logo_url: logoUrl, banner_url: bannerUrl })

    // ── Geocode the store address and store lat/lng ──────────────────────────
    geocodingService.geocodeMerchant(merchant.id, {
      address_line1: data.address_line1,
      city:          data.city,
      state:         data.state,
      postcode:      data.postcode,
    })
    // Fire and forget — don't await, don't block the save
    // ────────────────────────────────────────────────────────────────────────

    await refreshMerchant()
    Toast.show({ type: 'success', text1: 'Store updated!' })
  } catch (err: any) {
    Toast.show({ type: 'error', text1: 'Update failed', text2: err.message })
  }
  setIsSaving(false)
}
```


***

## Step 7 — Geocode on customer address save

Update your `app/(customer)/(profile)/address-form.tsx` (or wherever addresses are saved):

```typescript
// Add import at top
import { geocodingService } from '@/services/geocoding.service'

// After successfully inserting/updating the address row:
const onSubmit = async (data: FormData) => {
  setIsSaving(true)
  try {
    let savedId: string

    if (editing) {
      await supabase.from('addresses').update({ ...data }).eq('id', editing.id)
      savedId = editing.id
    } else {
      const { data: row } = await supabase
        .from('addresses')
        .insert({ ...data, user_id: user!.id })
        .select('id')
        .single()
      savedId = row!.id
    }

    // ── Geocode and store lat/lng ─────────────────────────────────────────────
    geocodingService.geocodeAddress(savedId, {
      address_line1: data.address_line1,
      address_line2: data.address_line2,
      city:          data.city,
      state:         data.state,
      postcode:      data.postcode,
    })
    // Fire and forget — user is not blocked
    // ─────────────────────────────────────────────────────────────────────────

    Toast.show({ type: 'success', text1: editing ? 'Address updated!' : 'Address saved!' })
    router.back()
  } catch (err: any) {
    Toast.show({ type: 'error', text1: 'Save failed', text2: err.message })
  }
  setIsSaving(false)
}
```


***

## Step 8 — Update `get-delivery-quotes` to read stored coords

Now that lat/lng are stored, the delivery function reads them directly and only uses the state fallback if geocoding hasn't run yet:

```typescript
// Replace the coords block in get-delivery-quotes/index.ts:

const STATE_COORDS: Record<string, { lat: string; lng: string }> = {
  'Johor':             { lat: '1.9344',  lng: '103.3587' },
  'Kedah':             { lat: '6.1184',  lng: '100.3685' },
  'Kelantan':          { lat: '6.1254',  lng: '102.2381' },
  'Melaka':            { lat: '2.1896',  lng: '102.2501' },
  'Negeri Sembilan':   { lat: '2.7258',  lng: '101.9424' },
  'Pahang':            { lat: '3.8126',  lng: '103.3256' },
  'Perak':             { lat: '4.5921',  lng: '101.0901' },
  'Perlis':            { lat: '6.4449',  lng: '100.2048' },
  'Pulau Pinang':      { lat: '5.4141',  lng: '100.3288' },
  'Sabah':             { lat: '5.9788',  lng: '116.0753' },
  'Sarawak':           { lat: '1.5535',  lng: '110.3592' },
  'Selangor':          { lat: '3.0738',  lng: '101.5183' },
  'Terengganu':        { lat: '5.3117',  lng: '103.1324' },
  'W.P. Kuala Lumpur': { lat: '3.1390',  lng: '101.6869' },
  'W.P. Labuan':       { lat: '5.2831',  lng: '115.2308' },
  'W.P. Putrajaya':    { lat: '2.9264',  lng: '101.6964' },
}

// In the main serve handler, after fetching merchant:
const merchantCoords = (merchant.lat && merchant.lng)
  ? { lat: String(merchant.lat), lng: String(merchant.lng) }
  : STATE_COORDS[merchant.state] ?? { lat: '3.1390', lng: '101.6869' }

// Also fetch customer address lat/lng from the addresses table
const { data: addrRow } = await supabase
  .from('addresses')
  .select('lat, lng')
  .eq('id', deliveryAddress.id)     // pass address.id from the app
  .single()

const customerCoords = (addrRow?.lat && addrRow?.lng)
  ? { lat: String(addrRow.lat), lng: String(addrRow.lng) }
  : STATE_COORDS[deliveryAddress.state] ?? { lat: '3.1390', lng: '101.6869' }
```

And update `DeliveryMethodPicker.tsx` to pass `addressId` in the payload:

```typescript
// In fetchQuotes(), add id to deliveryAddress:
body: {
  merchantId,
  deliveryAddress: {
    id:       selectedAddress!.id,          // ← add this
    line1:    selectedAddress!.address_line1,
    line2:    selectedAddress!.address_line2 ?? '',
    city:     selectedAddress!.city,
    state:    selectedAddress!.state,
    postcode: selectedAddress!.postcode,
  },
  totalWeightKg,
  parcelValue: cartSubtotal,
},
```


***

## Step 9 — Backfill existing addresses and merchants

Run this once in SQL Editor to geocode all existing rows that are missing coordinates:

```sql
-- Check which rows still need geocoding
SELECT id, store_name, address_line1, city, state, postcode
FROM merchants
WHERE lat IS NULL OR lng IS NULL;

SELECT id, label, address_line1, city, state, postcode
FROM addresses
WHERE lat IS NULL OR lng IS NULL;
```

For your current merchant and address, the quickest fix is to just re-save them through the app UI — Store Settings save will trigger geocoding automatically.

***

## Verify Checklist

| Test | Expected |
| :-- | :-- |
| Save merchant store settings | `geocode-address` Edge Function fires, `merchants.lat/lng` populated within ~1 second |
| Save customer address | `addresses.lat/lng` populated, visible in Supabase table |
| Open checkout with geocoded address | `get-delivery-quotes` reads stored coords — Lalamove quotes use accurate Penang coordinates |
| Open checkout with non-geocoded address | Falls back to state centre coords, delivery still works |
| `_debug` block in response | Shows real stored coordinates, not `3.1390, 101.6869` for non-KL addresses |

<span style="display:none">[^10][^11][^12][^13][^14][^15][^3][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://developers.google.com/maps/documentation/geocoding/overview

[^2]: https://developers.google.com/maps/documentation/geocoding/start

[^3]: https://new.hitsolution.com.my/2015/07/01/google-api-for-malaysia-postcode/

[^4]: https://www.facebook.com/groups/mygis/posts/10156882274173707/

[^5]: https://mapsplatform.google.com

[^6]: https://buildship.com/integrations/apps/google-maps-and-supabase

[^7]: https://www.youtube.com/watch?v=ppYWkIBvRzQ

[^8]: https://community.weweb.io/t/supabase-edge-functions-a-working-template-with-a-catch/9530

[^9]: https://www.here.com/docs/bundle/geocoding-and-search-api-developer-guide/page/topics/geocode-local-coverage.html

[^10]: https://www.reddit.com/r/Supabase/comments/1dv7vfs/code_working_edge_function_to_make_api_call/

[^11]: https://blog.mapspeople.com/mapsindoors/google-maps-api-description

[^12]: https://github.com/orgs/supabase/discussions/8779

[^13]: https://radar.com/blog/geocoding-apis

[^14]: https://stackoverflow.com/questions/78979217/how-to-import-my-supabase-db-types-in-edge-functions-deno

[^15]: https://supabase.com/blog/supabase-edge-functions-deploy-dashboard-deno-2-1

