import { Hono } from 'hono'
import { getSupabaseClient, Bindings } from '../lib/supabase'
import { GoogleMerchantClient, mapProductToGoogle } from '../lib/google-merchant'

const marketplace = new Hono<{ Bindings: Bindings }>()

// --- Routes ---
marketplace.get('/status', (c) => c.text('Marketplace services are active.'))


export default marketplace
