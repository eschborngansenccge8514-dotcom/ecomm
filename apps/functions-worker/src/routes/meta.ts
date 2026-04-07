import { Hono } from 'hono'
import { getSupabaseClient, Bindings } from '../lib/supabase'
import { exchangeForLongLivedToken } from '../../../../packages/integrations/meta/auth'
import { MetaPublisher } from '../../../../packages/integrations/meta/publisher'

const meta = new Hono<{ Bindings: Bindings }>()

// OAuth Callback handler
meta.get('/callback', async (c) => {
  const { code, state: merchantId } = c.req.query()
  const env = c.env
  const supabase = getSupabaseClient(env)

  if (!code || !merchantId) {
    return c.json({ error: 'Missing code or merchantId' }, 400)
  }

  try {
    // 1. Exchange short-lived code for a user access token
    // Note: The /oauth/access_token endpoint with code will return a short-lived token
    const tokenUrl = new URL('https://graph.facebook.com/v25.0/oauth/access_token')
    tokenUrl.searchParams.set('client_id', env.META_APP_ID || 'YOUR_META_APP_ID')
    tokenUrl.searchParams.set('client_secret', env.META_APP_SECRET || 'YOUR_META_APP_SECRET')
    tokenUrl.searchParams.set('redirect_uri', `https://functions-worker.jjooi1707.workers.dev/meta/callback`)
    tokenUrl.searchParams.set('code', code)

    const tokenRes = await fetch(tokenUrl.toString())
    if (!tokenRes.ok) {
      const errorData = await tokenRes.json()
      throw new Error(`Token exchange failed: ${JSON.stringify(errorData)}`)
    }
    const { access_token: userToken } = await tokenRes.json<{ access_token: string }>()

    // 2. Exchange short-lived user token for a long-lived user token (60 days)
    const { accessToken: longLivedToken, expiresIn } = await exchangeForLongLivedToken(
      userToken,
      env.META_APP_ID,
      env.META_APP_SECRET
    )

    // 3. Discover the Facebook Page and Instagram Business Account
    // Get the first available Page and its IG Business Account ID
    const accountsRes = await fetch(`https://graph.facebook.com/v25.0/me/accounts?access_token=${longLivedToken}`)
    const { data: accounts } = await accountsRes.json<{ data: any[] }>()
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No Facebook Pages found for this account')
    }

    const firstPage = accounts[0]
    const fbPageId = firstPage.id
    const pageAccessToken = firstPage.access_token // This is a never-expiring page token if based on a long-lived user token

    const igRes = await fetch(`https://graph.facebook.com/v25.0/${fbPageId}?fields=instagram_business_account&access_token=${pageAccessToken}`)
    const { instagram_business_account } = await igRes.json<{ instagram_business_account?: { id: string } }>()

    const igUserId = instagram_business_account?.id

    // 4. Save to Database
    const expiresAt = new Date(Date.now() + (expiresIn || 5184000) * 1000).toISOString()

    const { error } = await supabase
      .from('merchant_social_accounts')
      .upsert({
        merchant_id: merchantId,
        platform: 'meta',
        access_token: pageAccessToken, // Using page access token for publishing
        fb_page_id: fbPageId,
        ig_user_id: igUserId,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'merchant_id,platform' })

    if (error) throw error

    // 5. Redirect back to Social Hub
    return c.redirect(`${env.APP_URL}/social`)
  } catch (err: any) {
    console.error('Meta Callback Error:', err.message)
    return c.json({ error: err.message }, 500)
  }
})

meta.post('/auth/exchange', async (c) => {
  const { shortLivedToken, merchantId, appId, appSecret } = await c.req.json()
  const supabase = getSupabaseClient(c.env)

  try {
    const { accessToken, expiresIn } = await exchangeForLongLivedToken(
      shortLivedToken,
      appId,
      appSecret
    )

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    const { error } = await supabase
      .from('merchant_social_accounts')
      .upsert({
        merchant_id: merchantId,
        platform: 'meta',
        access_token: accessToken,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'merchant_id,platform' })

    if (error) throw error

    return c.json({ success: true, expiresAt })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// Manual publish trigger
meta.post('/publish/:postId', async (c) => {
  const postId = c.req.param('postId')
  const supabase = getSupabaseClient(c.env)

  const { data: post, error: postError } = await supabase
    .from('social_posts')
    .select('*, merchants(owner_id)')
    .eq('id', postId)
    .single()

  if (postError || !post) {
    return c.json({ error: 'Post not found' }, 404)
  }

  const { data: account, error: accError } = await supabase
    .from('merchant_social_accounts')
    .select('*')
    .eq('merchant_id', post.merchant_id)
    .eq('platform', 'meta')
    .single()

  if (accError || !account) {
    return c.json({ error: 'Meta account not connected' }, 400)
  }

  const publisher = new MetaPublisher(
    account.access_token,
    account.ig_user_id,
    account.fb_page_id
  )

  try {
    let platformPostId = ''
    if (post.platform === 'instagram' || post.platform === 'both') {
      if (post.post_type === 'carousel') {
        platformPostId = await publisher.publishIgCarousel({
          imageUrls: post.image_urls,
          caption: post.caption,
        })
      } else {
        const containerId = await publisher.createIgMediaContainer({
          imageUrl: post.image_urls[0],
          caption: post.caption,
        })
        platformPostId = await publisher.publishIgMedia(containerId)
      }
    }

    if (post.platform === 'facebook' || post.platform === 'both') {
      const fbId = await publisher.postToFbPage({
        message: post.caption,
        imageUrl: post.image_urls?.[0],
      })
      platformPostId = platformPostId ? `${platformPostId},${fbId}` : fbId
    }

    await supabase
      .from('social_posts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        platform_post_id: platformPostId,
      })
      .eq('id', postId)

    return c.json({ success: true, platformPostId })
  } catch (err: any) {
    await supabase
      .from('social_posts')
      .update({
        status: 'failed',
        error: err.message,
      })
      .eq('id', postId)

    return c.json({ error: err.message }, 500)
  }
})

export default meta
