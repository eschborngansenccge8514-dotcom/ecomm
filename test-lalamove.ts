import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildLalamoveHeaders, getLalamoveBaseUrl } from './supabase/functions/_shared/lalamove-auth.ts'
import { load } from 'https://deno.land/std@0.224.0/dotenv/mod.ts'

const envParams = await load({ envPath: '.env.local' });
for (const [key, value] of Object.entries(envParams)) {
  Deno.env.set(key, value);
}

const merchLat = '3.1486'
const merchLng = '101.6942'
const custLatS = '3.1500'
const custLngS = '101.7000'

const quoteBody = JSON.stringify({
  data: {
    serviceType: 'MOTORCYCLE',
    language: 'en_MY',
    stops: [
      {
        coordinates: { lat: merchLat, lng: merchLng },
        address: "Test Merchant Address, KL"
      },
      {
        coordinates: { lat: custLatS, lng: custLngS },
        address: "Test Customer Address, KL"
      }
    ],
    item: { quantity: '1', weight: 'LESS_THAN_3_KG', categories: ['OTHER'] }
  }
})

const apiKey = Deno.env.get('LALAMOVE_API_KEY')!
const apiSecret = Deno.env.get('LALAMOVE_API_SECRET')!

console.log('Sending quotation to Lalamove...')
const headers = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', '/v3/quotations', quoteBody, 'MY_KUL')
const res = await fetch('https://rest.sandbox.lalamove.com/v3/quotations', { method: 'POST', headers, body: quoteBody })

console.log('Status MY_KUL:', res.status)
const text = await res.text()
console.log('Response MY_KUL:', text.substring(0, 500))

const headers2 = await buildLalamoveHeaders(apiKey, apiSecret, 'POST', '/v3/quotations', quoteBody, 'MY')
const res2 = await fetch('https://rest.sandbox.lalamove.com/v3/quotations', { method: 'POST', headers: headers2, body: quoteBody })

console.log('Status MY:', res2.status)
const text2 = await res2.text()
console.log('Response MY:', text2.substring(0, 500))
