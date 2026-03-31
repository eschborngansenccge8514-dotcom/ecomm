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
  const { orderId, pointsToRedeem, customerId } = body ?? {}

  if (!orderId || !pointsToRedeem || !customerId)
    return err('orderId, pointsToRedeem, and customerId are required')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: order } = await supabase
    .from('orders')
    .select('id, merchant_id, customer_id, subtotal, total_amount, points_redeemed, discount_amount')
    .eq('id', orderId)
    .single()

  if (!order)                        return err('Order not found')
  if (order.customer_id !== customerId) return err('Unauthorised')
  if (order.points_redeemed > 0)     return err('Points already redeemed on this order')

  const { data: settings } = await supabase
    .from('loyalty_settings')
    .select('*')
    .eq('merchant_id', order.merchant_id)
    .single()

  if (!settings?.is_enabled) return err('Loyalty program not enabled')

  const { data: balance } = await supabase
    .from('loyalty_points')
    .select('balance')
    .eq('customer_id', customerId)
    .eq('merchant_id', order.merchant_id)
    .single()

  const currentBalance = balance?.balance ?? 0

  // Validate rules
  if (pointsToRedeem < settings.min_redeem_points)
    return err(`Minimum redemption is ${settings.min_redeem_points} points`)
  if (pointsToRedeem > currentBalance)
    return err(`Insufficient points (have ${currentBalance}, want ${pointsToRedeem})`)

  const discountRM     = Number((pointsToRedeem * Number(settings.rm_per_point)).toFixed(2))
  const maxDiscountRM  = Number((Number(order.subtotal) * Number(settings.max_redeem_pct) / 100).toFixed(2))
  const actualDiscount = Math.min(discountRM, maxDiscountRM)
  const actualPoints   = Math.floor(actualDiscount / Number(settings.rm_per_point))
  const newBalance     = currentBalance - actualPoints
  const newTotal       = Math.max(Number(order.total_amount) - actualDiscount, 0)

  // Deduct balance
  const { error: deductErr } = await supabase
    .from('loyalty_points')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('customer_id', customerId)
    .eq('merchant_id', order.merchant_id)

  if (deductErr) return err(`Deduction failed: ${deductErr.message}`)

  // Log transaction
  await supabase.from('points_transactions').insert({
    customer_id:   customerId,
    merchant_id:   order.merchant_id,
    order_id:      orderId,
    type:          'redeem',
    points_delta:  -actualPoints,
    balance_after: newBalance,
    description:   `Redeemed for order discount`,
    metadata:      { discountRM: actualDiscount, orderId },
  })

  // Update order totals
  await supabase.from('orders').update({
    points_redeemed: actualPoints,
    points_discount: actualDiscount,
    total_amount:    newTotal,
    discount_amount: Number(order.discount_amount ?? 0) + actualDiscount,
  }).eq('id', orderId)

  return ok({ actualPoints, discountRM: actualDiscount, newBalance, newTotal })
})
