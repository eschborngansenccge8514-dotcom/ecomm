import { Hono } from 'hono'
import { getSupabaseClient, Bindings } from '../lib/supabase'
import { encryptJson } from '../lib/crypto'
import { hmacSha256 } from '../lib/utils'

const lazada = new Hono<{ Bindings: Bindings }>()

lazada.post('/auth-start', async (c) => {
  try {
    const { tenant_id, region } = await c.req.json()
    if (!tenant_id) throw new Error('Missing tenant_id')

    const supabase = getSupabaseClient(c.env)
    const state = crypto.randomUUID()

    const { data: config } = await supabase.from('merchant_lazada_config').select('app_key').eq('merchant_id', tenant_id).single()
    if (!config) throw new Error('Lazada configuration not found')

    await supabase.from('oauth_states').insert({
      tenant_id,
      provider: 'lazada',
      state,
      metadata: { region },
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })

    const appKey = config.app_key
    const redirectUri = `${c.env.APP_URL}/api/integrations/lazada/callback`
    const authUrl = new URL('https://auth.lazada.com/oauth/authorize')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('force_auth', 'true')
    authUrl.searchParams.set('client_id', appKey)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', state)

    return c.json({ authorization_url: authUrl.toString(), state })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

lazada.get('/auth-callback', async (c) => {
  try {
    const code = c.req.query('code')
    const state = c.req.query('state')
    
    const supabase = getSupabaseClient(c.env)
    const { data: stateRow } = await supabase.from('oauth_states').select('*').eq('state', state).eq('provider', 'lazada').single()
    if (!stateRow) throw new Error('Invalid state')

    const { data: config } = await supabase.from('merchant_lazada_config').select('app_key, app_secret').eq('merchant_id', stateRow.tenant_id).single()
    if (!config) throw new Error('Lazada config not found')

    // Lazada token exchange logic (simplified)
    const timestamp = String(Date.now())
    const authPath = '/rest/auth/token/create'
    // Lazada sign logic differs slightly, but for now we'll assume standard REST if applicable
    
    const tokenRes = await fetch(`https://api.lazada.com.my${authPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, app_key: config.app_key, app_secret: config.app_secret })
    })

    const tokenData = (await tokenRes.json()) as any
    if (tokenData.code && tokenData.code !== '0') throw new Error(tokenData.message)

    const encrypted = await encryptJson(tokenData, c.env.APP_ENCRYPTION_KEY_BASE64)
    const { data: account } = await supabase.from('marketplace_accounts').upsert({
      tenant_id: stateRow.tenant_id,
      provider_id: 'lazada',
      shop_id: tokenData.country_user_info?.[0]?.seller_id || 'unknown',
      status: 'active'
    }).select().single()

    if (!account) throw new Error('Failed to save account')

    await supabase.from('marketplace_credentials').upsert({
      tenant_id: stateRow.tenant_id,
      account_id: account.id,
      credential_type: 'lazada_tokens',
      encrypted_payload: encrypted,
      expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString()
    })

    return c.redirect(`${c.env.APP_URL}/marketplace/lazada?success=true`)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

lazada.post('/webhook', async (c) => {
  const body = await c.req.json()
  const supabase = getSupabaseClient(c.env)
  await supabase.from('marketplace_webhooks_log').insert({ provider: 'lazada', payload: body })
  return c.text('ok')
})

export default lazada
