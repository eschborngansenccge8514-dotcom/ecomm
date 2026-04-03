import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ok  = (d: unknown) => new Response(JSON.stringify(d),           { headers: { ...CORS, 'Content-Type': 'application/json' } })
const err = (m: string)  => new Response(JSON.stringify({ error: m }), { headers: { ...CORS, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const body = await req.json().catch(() => null)
  const { order_id, points, customer_id, merchant_id } = body ?? {}

  if (!order_id || !points || !customer_id)
    return err('order_id, points, and customer_id are required')

  console.log(`Processing redemption for order ${order_id} (customer ${customer_id})...`)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: order, error: oErr } = await supabase
    .from('orders')
    .select('id, merchant_id, customer_id, subtotal, total_amount, points_redeemed, discount_amount')
    .eq('id', order_id)
    .single()

  if (oErr || !order) {
    console.error(`Order lookup failed for ${order_id}:`, oErr)
    return err(oErr?.message || 'Order not found')
  }

  if (order.customer_id !== customer_id) {
    console.warn(`Customer mismatch: order.customer_id=${order.customer_id}, body.customer_id=${customer_id}`)
    return err('Unauthorised')
  }

  if (order.points_redeemed > 0) {
    console.log(`Order ${order_id} already has ${order.points_redeemed} points redeemed.`)
    return err('Points already redeemed on this order')
  }

  const { data: settings, error: sErr } = await supabase
    .from('loyalty_settings')
    .select('*')
    .eq('merchant_id', order.merchant_id)
    .single()

  if (sErr || !settings?.is_enabled) {
    console.log(`Loyalty program disabled or missing for merchant ${order.merchant_id}`)
    return err('Loyalty program not enabled')
  }

  const { data: balance, error: bErr } = await supabase
    .from('loyalty_points')
    .select('balance')
    .eq('customer_id', customer_id)
    .eq('merchant_id', order.merchant_id)
    .single()

  if (bErr) {
    console.error(`Balance lookup failed for customer ${customer_id}:`, bErr)
    return err('Could not fetch loyalty balance')
  }

  const currentBalance = balance?.balance ?? 0

  // Validate rules
  if (points < settings.min_redeem_points) {
    return err(`Minimum redemption is ${settings.min_redeem_points} points`)
  }
  if (points > currentBalance) {
    return err(`Insufficient points (have ${currentBalance}, want ${points})`)
  }

  const discountRM     = Number((points * Number(settings.rm_per_point)).toFixed(2))
  const maxDiscountRM  = Number((Number(order.subtotal) * Number(settings.max_redeem_pct) / 100).toFixed(2))
  
  const actualDiscount = Math.min(discountRM, maxDiscountRM)
  const actualPoints   = Math.ceil(actualDiscount / Number(settings.rm_per_point)) // Use ceil to be fair to merchant
  
  const finalPoints    = Math.min(actualPoints, points)
  const newBalance     = currentBalance - finalPoints
  const newTotal       = Math.max(Number(order.total_amount) - actualDiscount, 0)

  console.log(`Requested: ${points} pts (RM ${discountRM}). Max allowed: RM ${maxDiscountRM}`)
  console.log(`Actual: ${actualDiscount} RM discount for ${finalPoints} points.`)

  // Deduct balance
  const { error: deductErr } = await supabase
    .from('loyalty_points')
    .update({ 
      balance:        newBalance, 
      updated_at:     new Date().toISOString() 
    })
    .eq('customer_id', customer_id)
    .eq('merchant_id', order.merchant_id)

  if (deductErr) {
    console.error(`Deduction failed for customer ${customer_id}:`, deductErr)
    return err(`Deduction failed: ${deductErr.message}`)
  }

  // Record transaction
  const { error: txErr } = await supabase
    .from('points_transactions')
    .insert({
      customer_id:   customer_id,
      merchant_id:   order.merchant_id,
      order_id:      order_id,
      type:          'redeem',
      points_delta:  -finalPoints,
      balance_after: newBalance,
      description:   `Redeemed for order discount`,
      metadata:      { discountRM: actualDiscount, order_id },
    })

  if (txErr) console.error(`Failed to record redemption transaction for order ${order_id}:`, txErr)

  // Update order totals
  const { error: updateErr } = await supabase
    .from('orders')
    .update({
      points_redeemed: finalPoints,
      points_discount: actualDiscount,
      total_amount:    newTotal,
      discount_amount: Number(order.discount_amount ?? 0) + actualDiscount,
    })
    .eq('id', order_id)

  if (updateErr) console.error(`Failed to update order ${order_id} totals:`, updateErr)

  console.log(`Successfully redeemed ${finalPoints} pts for order ${order_id}. New total: ${newTotal}`)
  return ok({ 
    success: true,
    actualPoints: finalPoints, 
    discountRM: actualDiscount, 
    newBalance, 
    newTotal 
  })
})
