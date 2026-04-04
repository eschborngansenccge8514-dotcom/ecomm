import { Hono } from 'hono'
import { getSupabaseClient, Bindings } from '../lib/supabase'
import { encryptJson } from '../lib/crypto'
import { hmacSha256 } from '../lib/utils'

const shopee = new Hono<{ Bindings: Bindings }>()

shopee.post('/auth-start', async (c) => {
  try {
    const { tenant_id } = await c.req.json()
    if (!tenant_id) throw new Error('Missing tenant_id')

    const supabase = getSupabaseClient(c.env)
    const state = crypto.randomUUID()

    const { data: config } = await supabase
      .from('merchant_shopee_config')
      .select('partner_id, partner_key')
      .eq('merchant_id', tenant_id)
      .single()

    if (!config) throw new Error('Shopee configuration not found')

    await supabase.from('oauth_states').insert({
      tenant_id,
      provider: 'shopee',
      state,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })

    const partnerId = config.partner_id
    const partnerKey = config.partner_key
    const redirectUri = `${c.env.APP_URL}/api/integrations/shopee/callback`
    const timestamp = Math.floor(Date.now() / 1000)
    const path = '/api/v2/shop/auth_partner'

    const sign = await hmacSha256(partnerKey, `${partnerId}${path}${timestamp}`)
    const authUrl = new URL('https://partner.shopeemobile.com/api/v2/shop/auth_partner')
    authUrl.searchParams.set('partner_id', partnerId)
    authUrl.searchParams.set('timestamp', String(timestamp))
    authUrl.searchParams.set('sign', sign)
    authUrl.searchParams.set('redirect', redirectUri)

    return c.json({ authorization_url: authUrl.toString(), state })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

shopee.get('/auth-callback', async (c) => {
  try {
    const code = c.req.query('code')
    const shopId = c.req.query('shop_id')
    const state = c.req.query('state')

    if (!code || !shopId || !state) throw new Error('Missing parameters')

    const supabase = getSupabaseClient(c.env)
    const { data: stateRow } = await supabase.from('oauth_states').select('*').eq('state', state).eq('provider', 'shopee').single()
    if (!stateRow) throw new Error('Invalid or expired state')

    const { data: config } = await supabase.from('merchant_shopee_config').select('partner_id, partner_key').eq('merchant_id', stateRow.tenant_id).single()
    if (!config) throw new Error('Merchant config not found')

    const path = '/api/v2/auth/token/get'
    const timestamp = Math.floor(Date.now() / 1000)
    const sign = await hmacSha256(config.partner_key, `${config.partner_id}${path}${timestamp}`)

    const tokenRes = await fetch(`https://partner.shopeemobile.com${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PARTNER-ID': config.partner_id,
        'X-TIMESTAMP': String(timestamp),
        'X-SIGN': sign
      },
      body: JSON.stringify({ code, partner_id: parseInt(config.partner_id), shop_id: parseInt(shopId) })
    })

    if (!tokenRes.ok) throw new Error('Token exchange failed')
    const tokenData = (await tokenRes.json()) as any

    const encryptionKey = c.env.APP_ENCRYPTION_KEY_BASE64
    const encryptedPayload = await encryptJson(tokenData, encryptionKey)

    const { data: account } = await supabase.from('marketplace_accounts').upsert({
      tenant_id: stateRow.tenant_id,
      provider_id: 'shopee',
      shop_id: shopId,
      status: 'active'
    }).select().single()

    if (!account) throw new Error('Failed to save account')

    await supabase.from('marketplace_credentials').upsert({
      tenant_id: stateRow.tenant_id,
      account_id: account.id,
      credential_type: 'shopee_v2_tokens',
      encrypted_payload: encryptedPayload,
      expires_at: new Date(Date.now() + (tokenData.expire_in || 3600) * 1000).toISOString()
    })

    return c.redirect(`${c.env.APP_URL}/marketplace/shopee?success=true`)
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

shopee.post('/webhook', async (c) => {
  const body = await c.req.json()
  const supabase = getSupabaseClient(c.env)
  // Shopee webhook signature validation usually requires raw body if available.
  // For now, logging to generic marketplace webhook handler bridge.
  await supabase.from('marketplace_webhooks_log').insert({
    provider: 'shopee',
    payload: body,
    received_at: new Date().toISOString()
  })
  return c.text('OK')
})

export default shopee
