import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getSupabaseClient, Bindings } from './lib/supabase'

import billplz from './routes/billplz'
import lalamove from './routes/lalamove'
import easyparcel from './routes/easyparcel'
import webhooks from './routes/webhooks'
import shopee from './routes/shopee'
import tiktok from './routes/tiktok'
import lazada from './routes/lazada'
import googleMerchant from './routes/google-merchant'
import razorpay from './routes/razorpay'
import internal from './routes/internal'
import einvoice from './routes/einvoice'
import storage from './routes/storage'
import marketplace from './routes/marketplace'

const app = new Hono<{ Bindings: Bindings }>()

// Middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-client-info', 'apikey'],
  maxAge: 600,
}))

// Root route for health check
app.get('/', (c) => c.text('Functions Worker is running!'))

// Register routes
app.route('/billplz', billplz)
app.route('/lalamove', lalamove)
app.route('/easyparcel', easyparcel)
app.route('/webhooks', webhooks)
app.route('/shopee', shopee)
app.route('/tiktok', tiktok)
app.route('/lazada', lazada)
app.route('/google-merchant', googleMerchant)
app.route('/razorpay', razorpay)
app.route('/internal', internal)
app.route('/einvoice', einvoice)
app.route('/marketplace', marketplace)

// Fallback: If deployed as a single-purpose function (e.g., named 'einvoice'), 
// mount critical routers at the root to handle paths like /poll-status directly.
app.route('/', einvoice)
app.route('/', billplz)

app.notFound((c) => {
  // Ensure CORS headers even on 404
  return c.text('Not Found', 404)
})

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    console.log(`Running scheduled task: ${event.cron}`)
    const supabase = getSupabaseClient(env)
    
    // Route based on cron pattern or manually trigger sync via internal endpoints
    if (event.cron === '0 8 * * *') {
      // Morning Briefing example
      await fetch(`${env.APP_URL}/internal/morning-briefing`, { method: 'POST' })
    }

    if (event.cron === '*/10 * * * *') {
      // Poll E-Invoice statuses every 10 minutes
      const response = await app.request('/einvoice/poll-status', { method: 'POST' }, env)
      console.log('E-Invoice Polling Status:', response.status)
    }
  }
}
