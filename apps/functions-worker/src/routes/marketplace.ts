import { Hono } from 'hono'
import { getSupabaseClient, Bindings } from '../lib/supabase'
import { GoogleMerchantClient, mapProductToGoogle } from '../lib/google-merchant'

const marketplace = new Hono<{ Bindings: Bindings }>()

// --- Job Runner (Background Processor) ---
marketplace.post('/job-runner', async (c) => {
  try {
    const supabase = getSupabaseClient(c.env)
    
    // 1. Claim available jobs
    const lockToken = crypto.randomUUID()
    const { data: jobs, error: claimError } = await supabase.rpc('claim_marketplace_sync_jobs', {
      p_lock_token: lockToken,
      p_limit: 10
    })

    if (claimError) throw claimError
    if (!jobs || jobs.length === 0) return c.json({ message: 'No jobs to process' })

    const results = []
    for (const job of jobs) {
      try {
        // 2. Process based on provider
        if (job.provider === 'google_merchant') {
          await processGoogleMerchantJob(supabase, job, c.env)
        } else {
          // Others: Shopee, TikTok, Lazada (to be ported or proxied)
          console.warn(`[Job Runner] Provider ${job.provider} not yet fully ported to worker. Skipping.`)
          continue
        }

        // 3. Update Status
        await supabase.from('marketplace_sync_jobs').update({
          status: 'succeeded',
          finished_at: new Date().toISOString(),
          lock_token: null,
          locked_at: null
        }).eq('id', job.id)

        results.push({ id: job.id, status: 'succeeded' })
      } catch (err: any) {
        console.error(`[Job Runner] Job ${job.id} failed:`, err)
        await supabase.from('marketplace_sync_jobs').update({
          status: 'failed',
          last_error_message: err.message,
          finished_at: new Date().toISOString(),
          lock_token: null,
          locked_at: null
        }).eq('id', job.id)
        results.push({ id: job.id, status: 'failed', error: err.message })
      }
    }

    return c.json({ jobsProcessed: jobs.length, results })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

async function processGoogleMerchantJob(supabase: any, job: any, env: Bindings) {
  const { data: account } = await supabase
    .from('marketplace_accounts')
    .select('*, google_merchant_data_sources(*)')
    .eq('id', job.marketplace_account_id)
    .single()

  if (!account) throw new Error('Account not found')
  const dataSource = account.google_merchant_data_sources?.find((ds: any) => ds.is_primary)
  if (!dataSource) throw new Error('No primary data source')

  const { data: product } = await supabase.from('products').select('*').eq('id', job.payload.product_id).single()
  if (!product) throw new Error('Product not found')

  const tokenData = typeof account.credentials_ref === 'string' ? JSON.parse(account.credentials_ref) : account.credentials_ref
  const client = new GoogleMerchantClient({
    accessToken: tokenData.access_token,
    merchantId: account.shop_id
  })

  const googlePayload = mapProductToGoogle(product, {
    contentLanguage: dataSource.content_language,
    feedLabel: dataSource.feed_label,
    baseUrl: env.APP_URL
  })

  await client.insertProduct(googlePayload)
}

export default marketplace
