import { Hono } from 'hono'
import { getSupabaseClient, Bindings } from '../lib/supabase'
import { GoogleMerchantClient, mapProductToGoogle } from '../lib/google-merchant'

const googleMerchant = new Hono<{ Bindings: Bindings }>()

googleMerchant.post('/auth-start', async (c) => {
  try {
    const { tenantId, returnTo } = await c.req.json()
    const state = crypto.randomUUID()
    const supabase = getSupabaseClient(c.env)

    await supabase.from('marketplace_events').insert({
      tenant_id: tenantId,
      provider_id: 'google_merchant',
      event_type: 'oauth_state',
      payload: { state, returnTo }
    })

    const clientId = c.env.GOOGLE_CLIENT_ID
    const redirectUri = encodeURIComponent(`${c.env.APP_URL}/api/integrations/google-merchant/callback`)
    const scope = encodeURIComponent('https://www.googleapis.com/auth/content')

    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`

    return c.json({ authorizationUrl: url })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

googleMerchant.get('/callback', async (c) => {
  try {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const supabase = getSupabaseClient(c.env)

    const { data: event } = await supabase
      .from('marketplace_events')
      .select('*')
      .eq('provider_id', 'google_merchant')
      .eq('event_type', 'oauth_state')
      .contains('payload', { state })
      .single()

    if (!event) throw new Error('Invalid state')

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code || '',
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${c.env.APP_URL}/api/integrations/google-merchant/callback`,
        grant_type: 'authorization_code'
      })
    })

    const tokenData = await tokenRes.json() as any
    if (tokenData.error) throw new Error(tokenData.error_description || tokenData.error)

    // Store tokens...
    return c.redirect(`${c.env.APP_URL}/marketplace/google?success=true`)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})
// --- Synchronization ---
googleMerchant.post('/sync-products', async (c) => {
  try {
    const supabase = getSupabaseClient(c.env)
    const { data: jobs } = await supabase
      .from('marketplace_sync_jobs')
      .select('*, marketplace_accounts(*, google_merchant_data_sources(*))')
      .eq('status', 'pending')
      .eq('job_type', 'sync_products')
      .limit(10)

    if (!jobs || jobs.length === 0) return c.json({ message: 'No jobs to process' })

    for (const job of jobs) {
      try {
        await supabase.from('marketplace_sync_jobs').update({ status: 'processing', started_at: new Date().toISOString() }).eq('id', job.id)
        
        const account = job.marketplace_accounts
        const dataSource = account.google_merchant_data_sources?.find((ds: any) => ds.is_primary)
        if (!dataSource) throw new Error('No primary data source')

        const { data: product } = await supabase.from('products').select('*').eq('id', job.payload.product_id).single()
        if (!product) throw new Error('Product not found')

        // Refresh token if needed
        let tokenData = typeof account.credentials_ref === 'string' ? JSON.parse(account.credentials_ref) : account.credentials_ref
        // (Assuming token refresh logic is handled or tokens are fresh for this demo)

        const client = new GoogleMerchantClient({
          accessToken: tokenData.access_token,
          merchantId: account.shop_id
        })

        const googlePayload = mapProductToGoogle(product, {
          contentLanguage: dataSource.content_language,
          feedLabel: dataSource.feed_label,
          baseUrl: c.env.APP_URL
        })

        await client.insertProduct(googlePayload)

        await supabase.from('marketplace_sync_jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', job.id)
      } catch (err: any) {
        await supabase.from('marketplace_sync_jobs').update({ status: 'failed', error_message: err.message, completed_at: new Date().toISOString() }).eq('id', job.id)
      }
    }

    return c.json({ success: true, processed: jobs.length })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

googleMerchant.post('/update-availability', async (c) => {
  try {
    const supabase = getSupabaseClient(c.env)
    const { data: jobs } = await supabase
      .from('marketplace_sync_jobs')
      .select('*, marketplace_accounts(*)')
      .eq('status', 'pending')
      .eq('job_type', 'update_availability')
      .limit(20)

    if (!jobs || jobs.length === 0) return c.json({ message: 'No availability jobs' })

    for (const job of jobs) {
      try {
        await supabase.from('marketplace_sync_jobs').update({ status: 'processing' }).eq('id', job.id)
        
        const account = job.marketplace_accounts
        const tokenData = typeof account.credentials_ref === 'string' ? JSON.parse(account.credentials_ref) : account.credentials_ref
        
        const client = new GoogleMerchantClient({
          accessToken: tokenData.access_token,
          merchantId: account.shop_id
        })

        await client.updateAvailability(job.payload.offer_id, job.payload.availability)

        await supabase.from('marketplace_sync_jobs').update({ status: 'completed' }).eq('id', job.id)
      } catch (err: any) {
        await supabase.from('marketplace_sync_jobs').update({ status: 'failed', error_message: err.message }).eq('id', job.id)
      }
    }

    return c.json({ success: true, updated: jobs.length })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

export default googleMerchant
