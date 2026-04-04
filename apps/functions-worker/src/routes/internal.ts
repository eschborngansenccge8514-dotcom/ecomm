import { Hono } from 'hono'
import { getSupabaseClient, Bindings } from '../lib/supabase'

const internal = new Hono<{ Bindings: Bindings }>()

// --- Push Notifications (Expo) ---
internal.post('/push', async (c) => {
  try {
    const { userId, userIds, title, body, data } = await c.req.json()
    const targetUserIds = userIds || (userId ? [userId] : [])
    if (targetUserIds.length === 0) throw new Error('userId or userIds is required')

    const supabase = getSupabaseClient(c.env)
    const { data: profiles } = await supabase.from('profiles').select('id, expo_push_token').in('id', targetUserIds)

    if (!profiles) throw new Error('Failed to fetch user profiles')

    const messages = profiles
      .filter(p => p.expo_push_token && p.expo_push_token.startsWith('ExponentPushToken'))
      .map(p => ({
        to: p.expo_push_token,
        sound: 'default',
        title,
        body,
        data: { ...data, userId: p.id }
      }))

    if (messages.length === 0) return c.json({ success: true, message: 'No valid tokens' })

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages)
    })

    const resData = (await res.json()) as any
    const logs = messages.map((m, i) => ({
      user_id: profiles.find(p => p.expo_push_token === m.to)?.id,
      title,
      body,
      data,
      status: resData.data[i].status,
      response_payload: resData.data[i]
    }))

    await supabase.from('push_notification_logs').insert(logs)

    return c.json({ success: true, count: messages.length })
  } catch (err: any) {
    return c.json({ error: err.message }, 200)
  }
})

// --- Loyalty Points ---
internal.post('/loyalty/award', async (c) => {
  try {
    const body = await c.req.json()
    const { orderId, points, customerId, reason, merchantId } = body
    const supabase = getSupabaseClient(c.env)

    // Manual Awarding
    if (points && customerId && merchantId) {
      const { data: existing } = await supabase.from('loyalty_points').select('*').eq('customer_id', customerId).eq('merchant_id', merchantId).maybeSingle()
      const currentBalance = existing?.balance ?? 0
      const newBalance = currentBalance + points

      await supabase.from('loyalty_points').upsert({
        customer_id: customerId,
        merchant_id: merchantId,
        balance: newBalance,
        total_earned: (existing?.total_earned ?? 0) + points,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'customer_id,merchant_id' })

      await supabase.from('points_transactions').insert({
        customer_id: customerId,
        merchant_id: merchantId,
        type: 'earn',
        points_delta: points,
        balance_after: newBalance,
        description: reason || 'Manual adjustment',
        order_id: orderId
      })

      return c.json({ success: true, newBalance })
    }

    // Automatic Awarding (Order Delivered)
    if (!orderId) throw new Error('orderId required')
    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single()
    if (!order || order.status !== 'delivered' || order.points_earned > 0 || !order.customer_id) {
       return c.json({ skipped: true })
    }

    const { data: settings } = await supabase.from('loyalty_settings').select('*').eq('merchant_id', order.merchant_id).single()
    if (!settings?.is_enabled) return c.json({ skipped: true, reason: 'disabled' })

    const orderSubtotal = Number(order.subtotal)
    const basePoints = Math.floor(orderSubtotal * Number(settings.points_per_rm))
    const pointsToAward = basePoints // Simplified multiplier logic for now or port getTier/getMultiplier

    const { data: existing } = await supabase.from('loyalty_points').select('*').eq('customer_id', order.customer_id).eq('merchant_id', order.merchant_id).maybeSingle()
    const newBalance = (existing?.balance ?? 0) + pointsToAward

    await supabase.from('loyalty_points').upsert({
      customer_id: order.customer_id,
      merchant_id: order.merchant_id,
      balance: newBalance,
      updated_at: new Date().toISOString()
    }, { onConflict: 'customer_id,merchant_id' })

    await supabase.from('points_transactions').insert({ customer_id: order.customer_id, merchant_id: order.merchant_id, order_id: order.id, type: 'earn', points_delta: pointsToAward, balance_after: newBalance })
    await supabase.from('orders').update({ points_earned: pointsToAward }).eq('id', order.id)

    return c.json({ success: true, pointsAwarded: pointsToAward })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

// --- Geocoding ---
internal.post('/geocode-address', async (c) => {
  const { type, id, addressString } = await c.req.json()
  const apiKey = c.env.GEOCODE_MAPS_API_KEY
  if (!apiKey) return c.json({ error: 'GEOCODE_MAPS_API_KEY not set' }, 400)
  if (!type || !id || !addressString) return c.json({ error: 'type, id and addressString required' }, 400)

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressString)}&region=my&key=${apiKey}`
    const res = await fetch(url)
    const data = (await res.json()) as any
    if (data.status !== 'OK' || !data.results?.[0]) {
      return c.json({ error: `Could not geocode: "${addressString}"` }, 400)
    }

    const { lat, lng } = data.results[0].geometry.location
    const supabase = getSupabaseClient(c.env)
    const locationWkt = `POINT(${lng} ${lat})`

    const table = type === 'merchant' ? 'merchants' : 'addresses'
    const { error: uErr } = await supabase
      .from(table)
      .update({ lat, lng, location: locationWkt })
      .eq('id', id)

    if (uErr) throw new Error(`DB update failed: ${uErr.message}`)

    return c.json({ lat, lng })
  } catch (err: any) {
    return c.json({ error: err.message }, 400)
  }
})

export default internal
