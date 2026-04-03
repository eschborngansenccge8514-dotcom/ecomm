import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ok  = (d: unknown) => new Response(JSON.stringify(d),           { headers: { ...CORS, 'Content-Type': 'application/json' } })
const err = (m: string)  => new Response(JSON.stringify({ error: m }), { headers: { ...CORS, 'Content-Type': 'application/json' } })

function getTier(totalSpent: number, settings: any) {
  if (totalSpent >= Number(settings.tier_platinum_rm)) return 'platinum'
  if (totalSpent >= Number(settings.tier_gold_rm))     return 'gold'
  if (totalSpent >= Number(settings.tier_silver_rm))   return 'silver'
  return 'bronze'
}

function getMultiplier(tier: string, settings: any) {
  switch (tier) {
    case 'platinum': return Number(settings.tier_platinum_multiplier)
    case 'gold':     return Number(settings.tier_gold_multiplier)
    case 'silver':   return Number(settings.tier_silver_multiplier)
    default:         return 1.0
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const body = await req.json().catch(() => null)
  const { order_id, points, customer_id, reason, merchant_id } = body ?? {}

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Handle Manual Awarding (AI Agent Gesture)
  if (points && customer_id && merchant_id) {
    console.log(`Manual award: ${points} pts to customer ${customer_id} (Reason: ${reason})`)
    
    // Get current balance
    const { data: existing } = await supabase
      .from('loyalty_points')
      .select('*')
      .eq('customer_id', customer_id)
      .eq('merchant_id', merchant_id)
      .single()

    const currentBalance = existing?.balance ?? 0
    const newBalance = currentBalance + points

    const { error: upsertErr } = await supabase
      .from('loyalty_points')
      .upsert({
        customer_id,
        merchant_id,
        balance: newBalance,
        total_earned: (existing?.total_earned ?? 0) + points,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'customer_id,merchant_id' })

    if (upsertErr) return err(upsertErr.message)

    await supabase.from('points_transactions').insert({
      customer_id,
      merchant_id,
      type: 'earn',
      points_delta: points,
      balance_after: newBalance,
      description: reason || 'Manual adjustment',
      order_id: order_id
    })

    return ok({ success: true, pointsAwarded: points, newBalance })
  }

  // 2. Original Automatic Order-based logic
  const finalOrderId = order_id || body?.orderId
  if (!finalOrderId) return err('order_id is required')

  console.log(`Processing order ${finalOrderId}...`)

  // Fetch order
  const { data: order, error: oErr } = await supabase
    .from('orders')
    .select('id, merchant_id, customer_id, subtotal, status, points_earned')
    .eq('id', finalOrderId)
    .single()

  if (oErr || !order) {
    console.error(`Order lookup failed for ${finalOrderId}:`, oErr)
    return err(oErr?.message || 'Order not found')
  }

  if (order.status !== 'delivered') {
    console.log(`Order ${order.id} status is ${order.status}, skipping point award.`)
    return ok({ skipped: true, reason: 'Order not delivered' })
  }

  if (order.points_earned > 0) {
    console.log(`Order ${order.id} already has ${order.points_earned} points awarded.`)
    return ok({ skipped: true, reason: 'Points already awarded' })
  }

  if (!order.customer_id) {
    console.log(`Order ${order.id} has no customer_id (guest checkout).`)
    return ok({ skipped: true, reason: 'Guest order — no loyalty points' })
  }

  // Fetch merchant loyalty settings
  const { data: settings, error: sErr } = await supabase
    .from('loyalty_settings')
    .select('*')
    .eq('merchant_id', order.merchant_id)
    .single()

  if (sErr || !settings?.is_enabled) {
    console.log(`Loyalty program disabled or missing for merchant ${order.merchant_id}`)
    return ok({ skipped: true, reason: 'Loyalty program disabled' })
  }

  // Get or create customer loyalty balance row
  const { data: existing } = await supabase
    .from('loyalty_points')
    .select('*')
    .eq('customer_id', order.customer_id)
    .eq('merchant_id', order.merchant_id)
    .single()

  const currentBalance  = existing?.balance           ?? 0
  const currentEarned   = existing?.total_earned      ?? 0
  const currentSpentRM  = Number(existing?.total_spent_rm ?? 0)

  // Calculate new points
  const orderSubtotal   = Number(order.subtotal)
  const basePoints      = Math.floor(orderSubtotal * Number(settings.points_per_rm))
  
  const newSpentRM      = currentSpentRM + orderSubtotal
  const tier            = getTier(newSpentRM, settings)
  const multiplier      = getMultiplier(tier, settings)
  const pointsToAward   = Math.floor(basePoints * multiplier)

  const newBalance      = currentBalance + pointsToAward
  const newEarned       = currentEarned + pointsToAward

  console.log(`Order Subtotal: ${orderSubtotal}, Base Points: ${basePoints}, Multiplier: ${multiplier} (Tier: ${tier})`)
  console.log(`Total Award: ${pointsToAward} pts. New Balance: ${newBalance}`)

  // Update loyalty balance
  const { error: upsertErr } = await supabase
    .from('loyalty_points')
    .upsert({
      customer_id:    order.customer_id,
      merchant_id:    order.merchant_id,
      balance:        newBalance,
      total_earned:   newEarned,
      total_spent_rm: newSpentRM,
      tier,
      updated_at:     new Date().toISOString(),
    }, { onConflict: 'customer_id,merchant_id' })

  if (upsertErr) {
    console.error(`Failed to update loyalty balance for customer ${order.customer_id}:`, upsertErr)
    return err(`Balance update failed: ${upsertErr.message}`)
  }

  // Record transaction
  const { error: txErr } = await supabase
    .from('points_transactions')
    .insert({
      customer_id:   order.customer_id,
      merchant_id:   order.merchant_id,
      order_id:      order.id,
      type:          'earn',
      points_delta:  pointsToAward,
      balance_after: newBalance,
      description:   `Earned for order ${order.id}`,
      metadata:      { subtotal: order.subtotal, multiplier, tier, basePoints },
    })

  if (txErr) console.error(`Failed to record points transaction for order ${order.id}:`, txErr)

  // Mark order as points awarded
  const { error: updateErr } = await supabase
    .from('orders')
    .update({ points_earned: pointsToAward })
    .eq('id', order.id)

  if (updateErr) console.error(`Failed to update order ${order.id} points_earned:`, updateErr)

  console.log(`Successfully awarded ${pointsToAward} pts to customer ${order.customer_id}`)
  return ok({ 
    success: true, 
    pointsAwarded: pointsToAward, 
    newBalance, 
    tier, 
    multiplier 
  })
})
