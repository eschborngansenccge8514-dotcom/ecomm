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
  if (data.status !== 'OK' || !data.results?.[0]) return null
  const { lat, lng } = data.results[0].geometry.location
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

  const locationWkt = `POINT(${coords.lng} ${coords.lat})`

  if (type === 'merchant') {
    const { error: uErr } = await supabase
      .from('merchants')
      .update({ 
        lat: coords.lat, 
        lng: coords.lng,
        location: locationWkt
      })
      .eq('id', id)
    if (uErr) {
      console.error(`[Geocode] Merchant update failed for ${id}:`, uErr)
      return err(`DB update failed: ${uErr.message}`)
    }
  }

  if (type === 'address') {
    const { error: uErr } = await supabase
      .from('addresses')
      .update({ 
        lat: coords.lat, 
        lng: coords.lng,
        location: locationWkt
      })
      .eq('id', id)
    if (uErr) {
      console.error(`[Geocode] Address update failed for ${id}:`, uErr)
      return err(`DB update failed: ${uErr.message}`)
    }
  }

  console.log(`Geocoded [${type}:${id}] → ${coords.lat}, ${coords.lng}`)
  return ok({ lat: coords.lat, lng: coords.lng })
})
