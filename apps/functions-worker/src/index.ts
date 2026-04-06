import './env_shim';
import { injectEnv } from './env_shim';
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
import logistics from './routes/logistics'
import whatsapp from './routes/whatsapp'

const app = new Hono<{ Bindings: Bindings }>()

// Middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-client-info', 'apikey'],
  maxAge: 600,
}) as any)

app.use('*', async (c, next) => {
  // Inject Worker bindings into process.env so agent/support-agent packages can
  // read SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_GENERATIVE_AI_API_KEY, etc.
  injectEnv(c.env as any)
  console.log(`[Request] ${c.req.method} ${c.req.path}`)
  await next()
})

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
app.route('/logistics', logistics)
app.route('/whatsapp', whatsapp)

// Explicit Fallbacks: When this worker is deployed as a single-purpose function 
// (e.g., named 'einvoice'), Supabase calls it with paths like '/consolidate' 
// instead of '/einvoice/consolidate'. These fallbacks ensure proper delegation.
const delegateToEinvoice = async (c: any) => {
  try {
    return await einvoice.fetch(c.req.raw, c.env, c.executionCtx)
  } catch (err: any) {
    return c.json({ error: `Delegation Failed: ${err.message}` }, 500)
  }
}

app.all('/consolidate', delegateToEinvoice)
app.all('/submit', delegateToEinvoice)
app.all('/poll-status', delegateToEinvoice)
app.all('/test-connection', delegateToEinvoice)

// Logistics legacy fallbacks (for get-delivery-quotes)
const delegateToLogistics = async (c: any) => {
  try {
    return await logistics.fetch(c.req.raw, c.env, c.executionCtx)
  } catch (err: any) {
    return c.json({ error: `Delegation Failed: ${err.message}` }, 500)
  }
}
app.all('/get-delivery-quotes', delegateToLogistics)
app.all('/easyparcel-create-order', async (c) => {
  try {
    const req = new Request(`${new URL(c.req.url).origin}/easyparcel/create-order`, c.req.raw)
    return await easyparcel.fetch(req, c.env, c.executionCtx)
  } catch (err: any) {
    return c.json({ error: `Delegation Failed: ${err.message}` }, 500)
  }
})
app.all('/easyparcel-sync-status', async (c) => {
  try {
    const req = new Request(`${new URL(c.req.url).origin}/easyparcel/sync-status`, c.req.raw)
    return await easyparcel.fetch(req, c.env, c.executionCtx)
  } catch (err: any) {
    return c.json({ error: `Delegation Failed: ${err.message}` }, 500)
  }
})
app.all('/easyparcel-sync-order-status', async (c) => {
  try {
    const req = new Request(`${new URL(c.req.url).origin}/easyparcel/sync-status`, c.req.raw)
    return await easyparcel.fetch(req, c.env, c.executionCtx)
  } catch (err: any) {
    return c.json({ error: `Delegation Failed: ${err.message}` }, 500)
  }
})
app.all('/lalamove-create-order', async (c) => {
  try {
    const req = new Request(`${new URL(c.req.url).origin}/lalamove/create-order`, c.req.raw)
    return await lalamove.fetch(req, c.env, c.executionCtx)
  } catch (err: any) {
    return c.json({ error: `Delegation Failed: ${err.message}` }, 500)
  }
})
app.all('/lalamove-get-order-status', async (c) => {
  try {
    const req = new Request(`${new URL(c.req.url).origin}/lalamove/status`, c.req.raw)
    return await lalamove.fetch(req, c.env, c.executionCtx)
  } catch (err: any) {
    return c.json({ error: `Delegation Failed: ${err.message}` }, 500)
  }
})
app.all('/lalamove-cancel', async (c) => {
  try {
    const req = new Request(`${new URL(c.req.url).origin}/lalamove/cancel`, c.req.raw)
    return await lalamove.fetch(req, c.env, c.executionCtx)
  } catch (err: any) {
    return c.json({ error: `Delegation Failed: ${err.message}` }, 500)
  }
})
app.all('/lalamove-test-connection', async (c) => {
  try {
    const req = new Request(`${new URL(c.req.url).origin}/lalamove/test-connection`, c.req.raw)
    return await lalamove.fetch(req, c.env, c.executionCtx)
  } catch (err: any) {
    return c.json({ error: `Delegation Failed: ${err.message}` }, 500)
  }
})
app.all('/lalamove-retry-order', async (c) => {
  try {
    const req = new Request(`${new URL(c.req.url).origin}/lalamove/retry-order`, c.req.raw)
    return await lalamove.fetch(req, c.env, c.executionCtx)
  } catch (err: any) {
    return c.json({ error: `Delegation Failed: ${err.message}` }, 500)
  }
})
app.all('/lalamove-add-priority-fee', async (c) => {
  try {
    const req = new Request(`${new URL(c.req.url).origin}/lalamove/add-priority-fee`, c.req.raw)
    return await lalamove.fetch(req, c.env, c.executionCtx)
  } catch (err: any) {
    return c.json({ error: `Delegation Failed: ${err.message}` }, 500)
  }
})
app.all('/award-loyalty-points', async (c) => {
  try {
    const req = new Request(`${new URL(c.req.url).origin}/internal/loyalty/award`, c.req.raw)
    return await internal.fetch(req, c.env, c.executionCtx)
  } catch (err: any) {
    return c.json({ error: `Delegation Failed: ${err.message}` }, 500)
  }
})
app.all('/razorpay-refund', async (c) => {
  try {
    const req = new Request(`${new URL(c.req.url).origin}/razorpay/refund`, c.req.raw)
    return await razorpay.fetch(req, c.env, c.executionCtx)
  } catch (err: any) {
    return c.json({ error: `Delegation Failed: ${err.message}` }, 500)
  }
})
app.all('/billplz-refund', async (c) => {
  try {
    const req = new Request(`${new URL(c.req.url).origin}/billplz/refund`, c.req.raw)
    return await billplz.fetch(req, c.env, c.executionCtx)
  } catch (err: any) {
    return c.json({ error: `Delegation Failed: ${err.message}` }, 500)
  }
})

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
