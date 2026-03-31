import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ok  = (d: unknown) => new Response(JSON.stringify(d),           { headers: { ...CORS, 'Content-Type': 'application/json' } })
const err = (m: string)  => new Response(JSON.stringify({ error: m }), { headers: { ...CORS, 'Content-Type': 'application/json' } })

function computeTier(totalSpentRM: number, settings: any): string {
  if (totalSpentRM >= settings.tier_platinum_rm) return 'platinum'
  if (totalSpentRM >= settings.tier_gold_rm)     return 'gold'
  if (totalSpentRM >= settings.tier_silver_rm)   return 'silver'
  return 'bronze'
}

function tierMultiplier(tier: string, settings: any): number {
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
  if (!body?.orderId) return err('orderId is required')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Fetch order
  const { data: order, error: oErr } = await supabase
    .from('orders')
    .select('id, merchant_id, customer_id, subtotal, status, points_earned')
    .eq('id', body.orderId)
    .single()

  if (oErr || !order) return err('Order not found')
  if (order.status !== 'delivered') return err('Order not yet delivered')
  if (order.points_earned > 0)      return err('Points already awarded for this order')
  if (!order.customer_id)           return err('Guest order — no loyalty points')

  // Fetch merchant loyalty settings
  const { data: settings } = await supabase
    .from('loyalty_settings')
    .select('*')
    .eq('merchant_id', order.merchant_id)
    .single()

  if (!settings?.is_enabled) return ok({ skipped: true, reason: 'Loyalty program disabled' })

  // Get or create customer loyalty balance row
  const { data: existing } = await supabase
    .from('loyalty_points')
    .select('*')
    .eq('customer_id', order.customer_id)
    .eq('merchant_id', order.merchant_id)
    .single()

  const currentBalance  = existing?.balance          ?? 0
  const currentEarned   = existing?.total_earned      ?? 0
  const currentSpentRM  = existing?.total_spent_rm    ?? 0
  const newSpentRM      = currentSpentRM + Number(order.subtotal)
  const tier            = computeTier(newSpentRM, settings)
  const multiplier      = tierMultiplier(tier, settings)
  const basePoints      = Math.floor(Number(order.subtotal) * Number(settings.points_per_rm))
  const pointsToAward   = Math.floor(basePoints * multiplier)
  const newBalance      = currentBalance + pointsToAward
  const newEarned       = currentEarned  + pointsToAward

  // Upsert balance
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

  if (upsertErr) return err(`Balance update failed: ${upsertErr.message}`)

  // Log transaction
  await supabase.from('points_transactions').insert({
    customer_id:   order.customer_id,
    merchant_id:   order.merchant_id,
    order_id:      order.id,
    type:          'earn',
    points_delta:  pointsToAward,
    balance_after: newBalance,
    description:   `Earned for order ${order.id}`,
    metadata:      { subtotal: order.subtotal, multiplier, tier, basePoints },
  })

  // Mark order as points awarded
  await supabase.from('orders').update({ points_earned: pointsToAward }).eq('id', order.id)

  console.log(`Awarded ${pointsToAward} pts to customer ${order.customer_id} (tier: ${tier}, ×${multiplier})`)
  return ok({ pointsAwarded: pointsToAward, newBalance, tier, multiplier })
})
