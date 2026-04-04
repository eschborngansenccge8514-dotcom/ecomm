import { Hono } from 'hono'
import { getSupabaseClient, Bindings } from '../lib/supabase'
import { encryptJson } from '../lib/crypto'
import { hmacSha256 } from '../lib/utils'

const tiktok = new Hono<{ Bindings: Bindings }>()

tiktok.post('/auth-start', async (c) => {
  try {
    const { tenant_id } = await c.req.json()
    if (!tenant_id) throw new Error('Missing tenant_id')

    const supabase = getSupabaseClient(c.env)
    const state = crypto.randomUUID()

    const { data: config } = await supabase.from('merchant_tiktok_config').select('app_key').eq('merchant_id', tenant_id).single()
    if (!config) throw new Error('TikTok configuration not found')

    await supabase.from('oauth_states').insert({
      tenant_id,
      provider: 'tiktok',
      state,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })

    const appKey = config.app_key
    const redirectUri = `${c.env.APP_URL}/api/integrations/tiktok/callback`
    const authUrl = `https://services.tiktokglobalshop.com/open/authorize?app_key=${appKey}&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`

    return c.json({ authorization_url: authUrl, state })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

tiktok.get('/auth-callback', async (c) => {
  try {
    const code = c.req.query('code')
    const state = c.req.query('state')

    const supabase = getSupabaseClient(c.env)
    const { data: stateData } = await supabase.from('oauth_states').select('*').eq('state', state).eq('provider', 'tiktok').single()
    if (!stateData) throw new Error('Invalid state')

    const { data: config } = await supabase.from('merchant_tiktok_config').select('app_key, app_secret').eq('merchant_id', stateData.tenant_id).single()
    if (!config) throw new Error('TikTok config not found')

    const tokenRes = await fetch('https://open-api.tiktokglobalshop.com/api/v2/token/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_key: config.app_key,
        app_secret: config.app_secret,
        auth_code: code,
        grant_type: 'authorized_code'
      })
    })

    const tokenData = (await tokenRes.json()) as any
    if (tokenData.code !== 0) throw new Error(tokenData.message)

    const { access_token, refresh_token, access_token_expire_in } = tokenData.data
    const { data: account } = await supabase.from('marketplace_accounts').upsert({
      tenant_id: stateData.tenant_id,
      provider_id: 'tiktok',
      shop_id: tokenData.data.open_id,
      shop_name: tokenData.data.seller_name,
      status: 'active'
    }).select().single()

    if (!account) throw new Error('Failed to save account')

    const encryptedTokens = await encryptJson({ access_token, refresh_token }, c.env.APP_ENCRYPTION_KEY_BASE64)
    await supabase.from('marketplace_credentials').upsert({
      tenant_id: stateData.tenant_id,
      account_id: account.id,
      credential_type: 'tiktok_tokens',
      encrypted_payload: encryptedTokens,
      expires_at: new Date(Date.now() + access_token_expire_in * 1000).toISOString()
    })

    return c.redirect(`${c.env.APP_URL}/marketplace/tiktok?success=true`)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

tiktok.post('/webhook', async (c) => {
  const raw = await c.req.text()
  const signature = c.req.header('x-tiktok-signature') || ''
  const payload = JSON.parse(raw)
  const supabase = getSupabaseClient(c.env)

  const shopId = payload.shop_id || payload.seller_id
  if (shopId) {
    const { data: account } = await supabase.from('marketplace_accounts').select('id, tenant_id').eq('provider_id', 'tiktok').eq('shop_id', String(shopId)).maybeSingle()
    if (account) {
      const { data: config } = await supabase.from('merchant_tiktok_config').select('app_secret').eq('merchant_id', account.tenant_id).single()
      const appSecret = config?.app_secret || c.env.TIKTOK_APP_SECRET
      if (appSecret && signature) {
        const expected = await hmacSha256(appSecret, raw)
        if (signature !== expected) {
          // console.warn('TikTok signature mismatch')
        }
      }
      await supabase.from('marketplace_webhooks_log').insert({
        provider: 'tiktok',
        tenant_id: account.tenant_id,
        payload,
        received_at: new Date().toISOString()
      })
    }
  }
  return c.text('ok')
})

export default tiktok
