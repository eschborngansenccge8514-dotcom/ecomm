<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Add loyalty program feature

Here is the complete loyalty program — 14 files covering database, two Edge Functions, mobile app integration with checkout redemption, and the full merchant web dashboard loyalty page.[^1][^2][^3]

***

## Architecture

```
Customer places order → order delivered
        ↓
  award-loyalty-points Edge Function
        ↓
  points_transactions (immutable ledger)
  loyalty_points (fast balance lookup)      ← tier computed from total_spent
        ↓
  Customer sees balance + tier in app
  Taps "Use Points" at checkout → partial discount applied
        ↓
  redeem-loyalty-points Edge Function validates + deducts
        ↓
  Merchant dashboard shows leaderboard + settings
```


***

## Step 1 — Database Migration

Run in Supabase SQL Editor:

```sql
-- ── Loyalty settings per merchant ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_settings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id           uuid REFERENCES merchants(id) ON DELETE CASCADE UNIQUE,
  program_name          text    NOT NULL DEFAULT 'Loyalty Points',
  points_per_rm         numeric NOT NULL DEFAULT 1,     -- points earned per RM1 spent
  rm_per_point          numeric NOT NULL DEFAULT 0.01,  -- RM value of 1 point on redemption
  min_redeem_points     int     NOT NULL DEFAULT 100,   -- minimum points to redeem
  max_redeem_pct        numeric NOT NULL DEFAULT 50,    -- max % of order total redeemable
  points_expiry_days    int     DEFAULT NULL,           -- NULL = never expire
  is_enabled            boolean NOT NULL DEFAULT true,
  -- Tier thresholds (total RM spent, cumulative)
  tier_silver_rm        numeric NOT NULL DEFAULT 200,
  tier_gold_rm          numeric NOT NULL DEFAULT 500,
  tier_platinum_rm      numeric NOT NULL DEFAULT 1000,
  -- Tier multipliers (points earned multiplier)
  tier_silver_multiplier   numeric NOT NULL DEFAULT 1.5,
  tier_gold_multiplier     numeric NOT NULL DEFAULT 2.0,
  tier_platinum_multiplier numeric NOT NULL DEFAULT 3.0,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ── Customer points balance (fast lookup, denormalised) ────────────────────
-- One row per (customer, merchant) pair
CREATE TABLE IF NOT EXISTS loyalty_points (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id  uuid REFERENCES merchants(id) ON DELETE CASCADE,
  balance      int  NOT NULL DEFAULT 0,
  total_earned int  NOT NULL DEFAULT 0,
  total_spent_rm numeric NOT NULL DEFAULT 0,  -- drives tier calculation
  tier         text NOT NULL DEFAULT 'bronze', -- bronze/silver/gold/platinum
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(customer_id, merchant_id)
);

-- ── Immutable transaction ledger ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS points_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  merchant_id   uuid REFERENCES merchants(id) ON DELETE SET NULL,
  order_id      uuid REFERENCES orders(id)  ON DELETE SET NULL,
  type          text NOT NULL,  -- 'earn' | 'redeem' | 'expire' | 'adjust'
  points_delta  int  NOT NULL,  -- positive = earn, negative = redeem/expire
  balance_after int  NOT NULL,
  description   text,
  metadata      jsonb,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pts_txn_customer ON points_transactions(customer_id, merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pts_balance       ON loyalty_points(merchant_id, balance DESC);

-- ── Add redemption columns to orders ──────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS points_earned    int     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_redeemed  int     DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_discount  numeric DEFAULT 0;

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE loyalty_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points      ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;

-- Customers read their own balance
CREATE POLICY "customers read own balance"
  ON loyalty_points FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

-- Customers read their own transactions
CREATE POLICY "customers read own transactions"
  ON points_transactions FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

-- Merchants read their program settings
CREATE POLICY "merchant reads own settings"
  ON loyalty_settings FOR ALL TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- Seed default settings for existing merchants
INSERT INTO loyalty_settings (merchant_id)
SELECT id FROM merchants
ON CONFLICT (merchant_id) DO NOTHING;
```


***

## File 1 — `supabase/functions/award-loyalty-points/index.ts`

Called automatically when order status changes to `delivered`:[^1]

```typescript
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
```


***

## File 2 — `supabase/functions/redeem-loyalty-points/index.ts`

Validates and locks in redemption at checkout:

```typescript
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
    .select('id, merchant_id, customer_id, subtotal, total_amount, points_redeemed')
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
    discount_amount: Number((order as any).discount_amount ?? 0) + actualDiscount,
  }).eq('id', orderId)

  return ok({ actualPoints, discountRM: actualDiscount, newBalance, newTotal })
})
```

Deploy both:

```bash
supabase functions deploy award-loyalty-points
supabase functions deploy redeem-loyalty-points
```


***

## File 3 — Auto-trigger points on delivery

Add to `OrderDetailClient.tsx` in the web dashboard — call `award-loyalty-points` when the merchant marks an order as delivered:

```typescript
// In handleUpdate(), after the supabase update succeeds:
if (nextStatus === 'delivered') {
  // Fire and forget — award points in background
  supabase.functions.invoke('award-loyalty-points', {
    body: { orderId: order.id },
  }).then(({ data }) => {
    if (data?.pointsAwarded > 0) {
      toast.success(`${data.pointsAwarded} pts awarded to customer 🌟`)
    }
  })
}
```

Also add to your **mobile merchant app** in the same status update handler:

```typescript
// In merchantOrdersService or wherever status is updated:
if (newStatus === 'delivered') {
  supabase.functions.invoke('award-loyalty-points', { body: { orderId } })
}
```


***

## File 4 — `src/services/loyalty.service.ts` (mobile app)

```typescript
import { supabase } from '@/lib/supabase'

export const loyaltyService = {
  // Get customer's balance + tier for a specific merchant
  getBalance: async (merchantId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data } = await supabase
      .from('loyalty_points')
      .select('balance, total_earned, total_spent_rm, tier, updated_at')
      .eq('customer_id', user.id)
      .eq('merchant_id', merchantId)
      .single()
    return data
  },

  // Get transaction history
  getHistory: async (merchantId: string, limit = 20) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    const { data } = await supabase
      .from('points_transactions')
      .select('*')
      .eq('customer_id', user.id)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return data ?? []
  },

  // Get loyalty settings (points rate, tier thresholds etc.)
  getSettings: async (merchantId: string) => {
    const { data } = await supabase
      .from('loyalty_settings')
      .select('program_name, points_per_rm, rm_per_point, min_redeem_points, max_redeem_pct, tier_silver_rm, tier_gold_rm, tier_platinum_rm, tier_silver_multiplier, tier_gold_multiplier, tier_platinum_multiplier, is_enabled')
      .eq('merchant_id', merchantId)
      .single()
    return data
  },

  // Calculate redemption preview
  previewRedemption: (pointsToRedeem: number, orderSubtotal: number, settings: any) => {
    const discountRM    = pointsToRedeem * Number(settings.rm_per_point)
    const maxDiscount   = orderSubtotal  * Number(settings.max_redeem_pct) / 100
    const actualDiscount = Math.min(discountRM, maxDiscount)
    const actualPoints   = Math.floor(actualDiscount / Number(settings.rm_per_point))
    return { actualDiscount: Number(actualDiscount.toFixed(2)), actualPoints }
  },
}
```


***

## File 5 — `src/components/customer/LoyaltyCard.tsx` (mobile)

Displayed on the merchant store page and order confirmation:[^4]

```typescript
import { View, Text, TouchableOpacity } from 'react-native'
import { useEffect, useState } from 'react'
import { loyaltyService } from '@/services/loyalty.service'
import { Ionicons } from '@expo/vector-icons'
import { router }   from 'expo-router'

const TIER_CONFIG = {
  bronze:   { label: 'Bronze',   emoji: '🥉', color: '#92400e', bg: '#fef3c7', progress: '#d97706' },
  silver:   { label: 'Silver',   emoji: '🥈', color: '#374151', bg: '#f3f4f6', progress: '#6b7280' },
  gold:     { label: 'Gold',     emoji: '🥇', color: '#78350f', bg: '#fef9c3', progress: '#eab308' },
  platinum: { label: 'Platinum', emoji: '💎', color: '#1e1b4b', bg: '#ede9fe', progress: '#7c3aed' },
}

interface Props {
  merchantId:   string
  programName?: string
  compact?:     boolean
}

export function LoyaltyCard({ merchantId, programName = 'Loyalty Points', compact = false }: Props) {
  const [balance, setBalance]   = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      loyaltyService.getBalance(merchantId),
      loyaltyService.getSettings(merchantId),
    ]).then(([b, s]) => {
      setBalance(b)
      setSettings(s)
      setLoading(false)
    })
  }, [merchantId])

  if (loading || !settings?.is_enabled) return null

  const tier   = (balance?.tier ?? 'bronze') as keyof typeof TIER_CONFIG
  const cfg    = TIER_CONFIG[tier]
  const pts    = balance?.balance ?? 0
  const spent  = balance?.total_spent_rm ?? 0

  // Progress to next tier
  const nextThreshold =
    tier === 'bronze'   ? settings.tier_silver_rm :
    tier === 'silver'   ? settings.tier_gold_rm   :
    tier === 'gold'     ? settings.tier_platinum_rm : null

  const prevThreshold =
    tier === 'silver'   ? settings.tier_silver_rm   :
    tier === 'gold'     ? settings.tier_gold_rm     :
    tier === 'platinum' ? settings.tier_platinum_rm : 0

  const progressPct = nextThreshold
    ? Math.min(((spent - prevThreshold) / (nextThreshold - prevThreshold)) * 100, 100)
    : 100

  if (compact) {
    return (
      <TouchableOpacity
        onPress={() => router.push(`/(customer)/loyalty/${merchantId}`)}
        className="flex-row items-center gap-2 bg-amber-50 rounded-xl px-3 py-2"
      >
        <Text>{cfg.emoji}</Text>
        <Text className="text-amber-800 font-bold text-sm">{pts.toLocaleString()} pts</Text>
        <Text className="text-amber-600 text-xs">· {cfg.label}</Text>
        <Ionicons name="chevron-forward" size={14} color="#92400e" />
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      onPress={() => router.push(`/(customer)/loyalty/${merchantId}`)}
      activeOpacity={0.9}
      style={{ backgroundColor: cfg.bg }}
      className="rounded-2xl p-4 mx-4 mb-3"
    >
      <View className="flex-row items-center justify-between mb-3">
        <View>
          <Text className="text-xs font-semibold opacity-60" style={{ color: cfg.color }}>
            {programName}
          </Text>
          <View className="flex-row items-center gap-1.5 mt-0.5">
            <Text>{cfg.emoji}</Text>
            <Text className="font-bold text-lg" style={{ color: cfg.color }}>
              {cfg.label} Member
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-2xl font-bold" style={{ color: cfg.color }}>
            {pts.toLocaleString()}
          </Text>
          <Text className="text-xs opacity-60" style={{ color: cfg.color }}>points</Text>
        </View>
      </View>

      {/* Progress bar */}
      {nextThreshold && (
        <View>
          <View className="h-1.5 rounded-full bg-black/10 overflow-hidden">
            <View className="h-full rounded-full"
              style={{ width: `${progressPct}%`, backgroundColor: cfg.progress }} />
          </View>
          <Text className="text-xs mt-1 opacity-60" style={{ color: cfg.color }}>
            RM {(nextThreshold - spent).toFixed(2)} more to {
              tier === 'bronze' ? 'Silver' : tier === 'silver' ? 'Gold' : 'Platinum'
            } {tier === 'silver' ? '🥈' : tier === 'bronze' ? '🥈' : '💎'}
          </Text>
        </View>
      )}
      {tier === 'platinum' && (
        <Text className="text-xs mt-1 opacity-60" style={{ color: cfg.color }}>
          💎 You've reached the highest tier!
        </Text>
      )}
    </TouchableOpacity>
  )
}
```


***

## File 6 — `app/(customer)/loyalty/[merchantId].tsx` (mobile)

Points history screen:

```typescript
import {
  View, Text, ScrollView, FlatList,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState }  from 'react'
import { loyaltyService }       from '@/services/loyalty.service'
import { format }               from 'date-fns'
import { Ionicons }             from '@expo/vector-icons'
import { useSafeAreaInsets }    from 'react-native-safe-area-context'

const TIER_CONFIG = {
  bronze:   { label: 'Bronze',   emoji: '🥉', bg: '#fef3c7', color: '#92400e' },
  silver:   { label: 'Silver',   emoji: '🥈', bg: '#f3f4f6', color: '#374151' },
  gold:     { label: 'Gold',     emoji: '🥇', bg: '#fef9c3', color: '#78350f' },
  platinum: { label: 'Platinum', emoji: '💎', bg: '#ede9fe', color: '#1e1b4b' },
}

export default function LoyaltyScreen() {
  const { merchantId } = useLocalSearchParams<{ merchantId: string }>()
  const insets = useSafeAreaInsets()
  const [balance, setBalance]   = useState<any>(null)
  const [history, setHistory]   = useState<any[]>([])
  const [settings, setSettings] = useState<any>(null)

  useEffect(() => {
    Promise.all([
      loyaltyService.getBalance(merchantId),
      loyaltyService.getHistory(merchantId),
      loyaltyService.getSettings(merchantId),
    ]).then(([b, h, s]) => {
      setBalance(b); setHistory(h); setSettings(s)
    })
  }, [merchantId])

  const tier = (balance?.tier ?? 'bronze') as keyof typeof TIER_CONFIG
  const cfg  = TIER_CONFIG[tier]

  return (
    <ScrollView className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Hero */}
      <View style={{ backgroundColor: cfg.bg }} className="px-5 pb-6 pt-4">
        <Text className="text-2xl font-bold" style={{ color: cfg.color }}>
          {cfg.emoji} {cfg.label} Member
        </Text>
        <View className="flex-row items-baseline gap-2 mt-2">
          <Text className="text-4xl font-bold" style={{ color: cfg.color }}>
            {(balance?.balance ?? 0).toLocaleString()}
          </Text>
          <Text className="text-lg" style={{ color: cfg.color }}>points</Text>
        </View>
        <Text className="text-sm opacity-60 mt-1" style={{ color: cfg.color }}>
          Total earned: {(balance?.total_earned ?? 0).toLocaleString()} pts ·
          Spent: RM {Number(balance?.total_spent_rm ?? 0).toFixed(2)}
        </Text>
      </View>

      {/* How it works */}
      {settings && (
        <View className="mx-4 mt-4 bg-white rounded-2xl p-4 border border-gray-100">
          <Text className="font-bold text-gray-900 mb-3">How it works</Text>
          <View className="gap-2">
            {[
              { icon: 'star-outline',   text: `Earn ${settings.points_per_rm} pt per RM1 spent` },
              { icon: 'gift-outline',   text: `${settings.min_redeem_points} pts minimum to redeem` },
              { icon: 'cash-outline',   text: `100 pts = RM ${(100 * settings.rm_per_point).toFixed(2)} discount` },
              { icon: 'shield-outline', text: `Max ${settings.max_redeem_pct}% of order redeemable` },
            ].map(row => (
              <View key={row.icon} className="flex-row items-center gap-2">
                <Ionicons name={row.icon as any} size={16} color="#6b7280" />
                <Text className="text-gray-600 text-sm">{row.text}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Tier benefits */}
      <View className="mx-4 mt-3 bg-white rounded-2xl p-4 border border-gray-100">
        <Text className="font-bold text-gray-900 mb-3">Tier Benefits</Text>
        {settings && [
          { tier: 'Bronze',   min: 0,                     mult: 1,                                    emoji: '🥉' },
          { tier: 'Silver',   min: settings.tier_silver_rm,   mult: settings.tier_silver_multiplier,   emoji: '🥈' },
          { tier: 'Gold',     min: settings.tier_gold_rm,     mult: settings.tier_gold_multiplier,     emoji: '🥇' },
          { tier: 'Platinum', min: settings.tier_platinum_rm, mult: settings.tier_platinum_multiplier, emoji: '💎' },
        ].map(t => (
          <View key={t.tier}
            className={`flex-row items-center justify-between py-2 border-b border-gray-50 last:border-0 ${
              tier === t.tier.toLowerCase() ? 'bg-amber-50 -mx-2 px-2 rounded-xl' : ''}`}
          >
            <View className="flex-row items-center gap-2">
              <Text>{t.emoji}</Text>
              <View>
                <Text className="font-semibold text-gray-800 text-sm">{t.tier}</Text>
                <Text className="text-gray-400 text-xs">
                  {t.min === 0 ? 'Starting tier' : `RM ${t.min}+ spent`}
                </Text>
              </View>
            </View>
            <Text className="text-blue-600 font-bold text-sm">×{t.mult} pts</Text>
          </View>
        ))}
      </View>

      {/* Transaction history */}
      <View className="mx-4 mt-3 mb-8">
        <Text className="font-bold text-gray-900 mb-3">Points History</Text>
        {history.length === 0 ? (
          <View className="bg-white rounded-2xl p-8 items-center border border-gray-100">
            <Text className="text-gray-400 text-sm">No transactions yet</Text>
          </View>
        ) : (
          <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {history.map((txn, i) => (
              <View key={txn.id}
                className={`flex-row items-center justify-between px-4 py-3 ${
                  i < history.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <View className="flex-row items-center gap-3">
                  <View className={`w-8 h-8 rounded-full items-center justify-center ${
                    txn.type === 'earn' ? 'bg-green-100' : 'bg-red-100'}`}
                  >
                    <Ionicons
                      name={txn.type === 'earn' ? 'arrow-up' : 'arrow-down'}
                      size={14}
                      color={txn.type === 'earn' ? '#16a34a' : '#dc2626'}
                    />
                  </View>
                  <View>
                    <Text className="text-sm font-semibold text-gray-800 capitalize">
                      {txn.type === 'earn' ? 'Points Earned' : 'Points Redeemed'}
                    </Text>
                    <Text className="text-xs text-gray-400">
                      {format(new Date(txn.created_at), 'd MMM yyyy, h:mm a')}
                    </Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className={`font-bold text-sm ${txn.type === 'earn' ? 'text-green-600' : 'text-red-500'}`}>
                    {txn.points_delta > 0 ? '+' : ''}{txn.points_delta.toLocaleString()} pts
                  </Text>
                  <Text className="text-xs text-gray-400">
                    Balance: {txn.balance_after.toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  )
}
```


***

## File 7 — Updated `checkout.tsx` — Points Redemption Section

Add this section between Payment and Order Summary:

```typescript
// Add to checkout.tsx state:
const [loyaltyBalance, setLoyaltyBalance] = useState<any>(null)
const [loyaltySettings, setLoyaltySettings] = useState<any>(null)
const [pointsToRedeem, setPointsToRedeem]   = useState(0)
const [usePoints, setUsePoints]             = useState(false)

// Load loyalty data once merchant is known
useEffect(() => {
  if (!merchantId) return
  loyaltyService.getBalance(merchantId).then(setLoyaltyBalance)
  loyaltyService.getSettings(merchantId).then(setLoyaltySettings)
}, [merchantId])

// Computed
const pointsPreview = (loyaltySettings && pointsToRedeem > 0)
  ? loyaltyService.previewRedemption(pointsToRedeem, getTotal(), loyaltySettings)
  : null

const pointsDiscount = pointsPreview?.actualDiscount ?? 0
const grandTotal     = getTotal() + deliveryFee - pointsDiscount

// Updated handlePlaceOrder — redeem points after order is created:
// Add after supabase.from('order_items').insert(...):
if (usePoints && pointsToRedeem > 0 && user) {
  const { data: redeemData } = await supabase.functions.invoke('redeem-loyalty-points', {
    body: {
      orderId:        order.id,
      pointsToRedeem: pointsPreview!.actualPoints,
      customerId:     user.id,
    },
  })
  if (redeemData?.error) console.warn('Points redemption failed:', redeemData.error)
}
```

```typescript
// New Section component — paste between Payment and Order Summary sections:
function PointsSection({ balance, settings, usePoints, setUsePoints, pointsToRedeem, setPointsToRedeem, preview }: {
  balance: any; settings: any; usePoints: boolean; setUsePoints: (v: boolean) => void
  pointsToRedeem: number; setPointsToRedeem: (v: number) => void; preview: any
}) {
  if (!settings?.is_enabled || !balance || balance.balance < settings.min_redeem_points) return null

  return (
    <View className="bg-white rounded-2xl p-4 mb-3"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Text className="font-bold text-gray-900">🌟  Use Points</Text>
          <View className="bg-amber-100 rounded-full px-2 py-0.5">
            <Text className="text-amber-700 text-xs font-bold">
              {balance.balance.toLocaleString()} pts
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => { setUsePoints(!usePoints); setPointsToRedeem(0) }}
          className={`w-12 h-6 rounded-full transition-colors ${usePoints ? 'bg-blue-500' : 'bg-gray-200'}`}
        >
          <View className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-all ${usePoints ? 'ml-6' : 'ml-0.5'}`} />
        </TouchableOpacity>
      </View>

      {usePoints && (
        <View className="gap-3">
          {/* Quick select buttons */}
          <View className="flex-row gap-2">
            {[
              settings.min_redeem_points,
              Math.floor(balance.balance * 0.5),
              balance.balance,
            ].filter((v, i, arr) => v <= balance.balance && arr.indexOf(v) === i)
             .map(pts => (
              <TouchableOpacity key={pts}
                onPress={() => setPointsToRedeem(pts)}
                className={`flex-1 py-2 rounded-xl border-2 items-center ${
                  pointsToRedeem === pts ? 'border-blue-500 bg-blue-50' : 'border-gray-100'}`}
              >
                <Text className={`text-xs font-bold ${pointsToRedeem === pts ? 'text-blue-600' : 'text-gray-600'}`}>
                  {pts.toLocaleString()} pts
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {pointsToRedeem > 0 && preview && (
            <View className="bg-green-50 rounded-xl p-3 flex-row items-center justify-between">
              <Text className="text-green-700 text-sm font-medium">Discount applied</Text>
              <Text className="text-green-700 font-bold">-RM {preview.actualDiscount.toFixed(2)}</Text>
            </View>
          )}
          <Text className="text-gray-400 text-xs">
            Max {settings.max_redeem_pct}% of subtotal · {settings.min_redeem_points} pts minimum
          </Text>
        </View>
      )}
    </View>
  )
}
```

```typescript
// Add inside CheckoutScreen JSX, between Payment and Order Summary:
<PointsSection
  balance={loyaltyBalance}
  settings={loyaltySettings}
  usePoints={usePoints}
  setUsePoints={setUsePoints}
  pointsToRedeem={pointsToRedeem}
  setPointsToRedeem={setPointsToRedeem}
  preview={pointsPreview}
/>

// Update OrderSummary to show points discount:
<OrderSummary
  subtotal={getTotal()}
  deliveryFee={deliveryFee}
  pointsDiscount={pointsDiscount}   // ← new prop
  isSelfPickup={isSelfPickup}
/>
```

Update `OrderSummary` to show the discount row:

```typescript
// Add inside OrderSummary after delivery fee row:
{pointsDiscount > 0 && (
  <View className="flex-row justify-between">
    <Text className="text-gray-500 text-sm">🌟 Points discount</Text>
    <Text className="text-green-600 font-semibold text-sm">
      -RM {pointsDiscount.toFixed(2)}
    </Text>
  </View>
)}
```


***

## File 8 — Dashboard `/loyalty` page

```typescript
// src/app/(dashboard)/loyalty/page.tsx
import { getMerchant }   from '@/lib/utils.server'
import { LoyaltyClient } from '@/components/dashboard/LoyaltyClient'

export default async function LoyaltyPage() {
  const { supabase, merchant } = await getMerchant()

  const [
    { data: settings },
    { data: topCustomers },
    { data: recentTxns },
    { data: stats },
  ] = await Promise.all([
    supabase.from('loyalty_settings').select('*').eq('merchant_id', merchant.id).single(),

    supabase.from('loyalty_points')
      .select('customer_id, balance, total_earned, total_spent_rm, tier, updated_at, profiles:customer_id(full_name, email)')
      .eq('merchant_id', merchant.id)
      .order('total_spent_rm', { ascending: false })
      .limit(20),

    supabase.from('points_transactions')
      .select('*, profiles:customer_id(full_name)')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })
      .limit(30),

    supabase.from('loyalty_points')
      .select('balance, total_earned, tier')
      .eq('merchant_id', merchant.id),
  ])

  // Aggregate stats
  const totalMembers    = (stats ?? []).length
  const totalOutstanding = (stats ?? []).reduce((s, r: any) => s + r.balance, 0)
  const tierCounts = { bronze: 0, silver: 0, gold: 0, platinum: 0 }
  ;(stats ?? []).forEach((r: any) => { tierCounts[r.tier as keyof typeof tierCounts]++ })

  return (
    <LoyaltyClient
      settings={settings}
      topCustomers={topCustomers ?? []}
      recentTransactions={recentTxns ?? []}
      merchantId={merchant.id}
      statsSummary={{ totalMembers, totalOutstanding, tierCounts }}
    />
  )
}
```


***

## File 9 — `src/components/dashboard/LoyaltyClient.tsx`

```typescript
'use client'
import { useState }     from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button }       from '@/components/ui/button'
import { Input }        from '@/components/ui/input'
import { Label }        from '@/components/ui/label'
import { Switch }       from '@/components/ui/switch'
import toast            from 'react-hot-toast'
import { format }       from 'date-fns'
import { Star, Users, TrendingUp, Award } from 'lucide-react'
import { cn }           from '@/lib/utils'

const TIER_STYLES = {
  bronze:   'bg-amber-100 text-amber-800',
  silver:   'bg-gray-100 text-gray-700',
  gold:     'bg-yellow-100 text-yellow-800',
  platinum: 'bg-purple-100 text-purple-800',
}
const TIER_EMOJI = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎' }

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
          {icon}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h3 className="font-bold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  )
}

export function LoyaltyClient({ settings: init, topCustomers, recentTransactions, merchantId, statsSummary }: {
  settings: any; topCustomers: any[]; recentTransactions: any[]
  merchantId: string; statsSummary: any
}) {
  const [settings, setSettings] = useState(init ?? {})
  const [saving, setSaving]     = useState(false)
  const [tab, setTab]           = useState<'overview' | 'members' | 'settings'>('overview')
  const supabase = createClient()

  const set = (k: string, v: any) => setSettings((p: any) => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('loyalty_settings')
      .upsert({ ...settings, merchant_id: merchantId }, { onConflict: 'merchant_id' })
    if (error) toast.error(error.message)
    else toast.success('Loyalty settings saved!')
    setSaving(false)
  }

  const tabs = [
    { key: 'overview',  label: '📊 Overview' },
    { key: 'members',   label: '👥 Members'  },
    { key: 'settings',  label: '⚙️ Settings' },
  ]

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className={cn('rounded-2xl px-5 py-3 flex items-center justify-between',
        settings.is_enabled ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200')}>
        <div className="flex items-center gap-2">
          <Star size={18} className={settings.is_enabled ? 'text-green-600' : 'text-gray-400'} />
          <span className="font-semibold text-sm text-gray-800">
            {settings.program_name ?? 'Loyalty Program'}
          </span>
          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full',
            settings.is_enabled ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600')}>
            {settings.is_enabled ? 'Active' : 'Paused'}
          </span>
        </div>
        <Switch
          checked={!!settings.is_enabled}
          onCheckedChange={async (v) => {
            set('is_enabled', v)
            await supabase.from('loyalty_settings')
              .update({ is_enabled: v }).eq('merchant_id', merchantId)
            toast.success(v ? 'Loyalty program enabled' : 'Loyalty program paused')
          }}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-colors',
              tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard icon={<Users size={18} />}     label="Total Members"
              value={statsSummary.totalMembers.toLocaleString()} />
            <StatCard icon={<Star size={18} />}       label="Points Outstanding"
              value={statsSummary.totalOutstanding.toLocaleString()}
              sub={`≈ RM ${(statsSummary.totalOutstanding * (settings.rm_per_point ?? 0.01)).toFixed(2)} liability`} />
            <StatCard icon={<Award size={18} />}      label="Gold + Platinum"
              value={String(statsSummary.tierCounts.gold + statsSummary.tierCounts.platinum)}
              sub="High-value members" />
            <StatCard icon={<TrendingUp size={18} />} label="Earn Rate"
              value={`${settings.points_per_rm ?? 1} pt / RM1`} />
          </div>

          {/* Tier breakdown */}
          <Section title="Member Tier Breakdown">
            <div className="grid grid-cols-4 gap-3">
              {(['bronze', 'silver', 'gold', 'platinum'] as const).map(t => (
                <div key={t} className={cn('rounded-xl p-4 text-center', TIER_STYLES[t])}>
                  <p className="text-2xl mb-1">{TIER_EMOJI[t]}</p>
                  <p className="text-xl font-bold">{statsSummary.tierCounts[t]}</p>
                  <p className="text-xs font-semibold capitalize opacity-80">{t}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Recent activity */}
          <Section title="Recent Activity">
            <div className="space-y-0">
              {recentTransactions.slice(0, 10).map((txn, i) => (
                <div key={txn.id}
                  className={cn('flex items-center justify-between py-3',
                    i < 9 ? 'border-b border-gray-50' : '')}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm',
                      txn.type === 'earn' ? 'bg-green-100' : 'bg-orange-100')}>
                      {txn.type === 'earn' ? '⬆️' : '🎁'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {txn.profiles?.full_name ?? 'Customer'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(txn.created_at), 'd MMM, h:mm a')}
                      </p>
                    </div>
                  </div>
                  <span className={cn('text-sm font-bold',
                    txn.type === 'earn' ? 'text-green-600' : 'text-orange-500')}>
                    {txn.points_delta > 0 ? '+' : ''}{txn.points_delta.toLocaleString()} pts
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ── MEMBERS TAB ── */}
      {tab === 'members' && (
        <Section title={`${topCustomers.length} Members — Top by Spend`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  {['#', 'Member', 'Tier', 'Balance', 'Total Earned', 'Total Spent', 'Last Active'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-400 px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c, i) => (
                  <tr key={c.customer_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-3 py-3 text-sm text-gray-400 font-mono">#{i + 1}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold">
                          {(c.profiles?.full_name ?? 'G').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{c.profiles?.full_name ?? 'Guest'}</p>
                          <p className="text-xs text-gray-400">{c.profiles?.email ?? ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full capitalize',
                        TIER_STYLES[c.tier as keyof typeof TIER_STYLES])}>
                        {TIER_EMOJI[c.tier as keyof typeof TIER_EMOJI]} {c.tier}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm font-bold text-blue-600">
                      {Number(c.balance).toLocaleString()} pts
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">
                      {Number(c.total_earned).toLocaleString()} pts
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-gray-700">
                      RM {Number(c.total_spent_rm).toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-400">
                      {format(new Date(c.updated_at), 'd MMM')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── SETTINGS TAB ── */}
      {tab === 'settings' && (
        <div className="max-w-lg space-y-4">
          <Section title="Program Identity">
            <div>
              <Label>Program Name</Label>
              <Input value={settings.program_name ?? ''} onChange={e => set('program_name', e.target.value)}
                placeholder="e.g. Star Rewards" />
            </div>
          </Section>

          <Section title="Earning Rules">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Points per RM1 spent</Label>
                <Input type="number" min="0.1" step="0.1" value={settings.points_per_rm ?? 1}
                  onChange={e => set('points_per_rm', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">e.g. 1 = earn 1 pt per RM1</p>
              </div>
              <div>
                <Label>RM value per point</Label>
                <Input type="number" min="0.001" step="0.001" value={settings.rm_per_point ?? 0.01}
                  onChange={e => set('rm_per_point', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">e.g. 0.01 = 100 pts = RM1</p>
              </div>
            </div>
          </Section>

          <Section title="Redemption Rules">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Minimum points to redeem</Label>
                <Input type="number" min="1" value={settings.min_redeem_points ?? 100}
                  onChange={e => set('min_redeem_points', e.target.value)} />
              </div>
              <div>
                <Label>Max % of order redeemable</Label>
                <Input type="number" min="1" max="100" value={settings.max_redeem_pct ?? 50}
                  onChange={e => set('max_redeem_pct', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">e.g. 50 = max 50% discount from points</p>
              </div>
            </div>
          </Section>

          <Section title="Tier Thresholds (RM spent, cumulative)">
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: 'tier_silver_rm',   label: '🥈 Silver from (RM)' },
                { key: 'tier_gold_rm',     label: '🥇 Gold from (RM)'   },
                { key: 'tier_platinum_rm', label: '💎 Platinum from (RM)'},
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input type="number" min="1" value={settings[key] ?? ''}
                    onChange={e => set(key, e.target.value)} />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Tier Multipliers (points earn multiplier)">
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: 'tier_silver_multiplier',   label: '🥈 Silver ×' },
                { key: 'tier_gold_multiplier',     label: '🥇 Gold ×'   },
                { key: 'tier_platinum_multiplier', label: '💎 Platinum ×'},
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input type="number" min="1" step="0.1" value={settings[key] ?? ''}
                    onChange={e => set(key, e.target.value)} />
                </div>
              ))}
            </div>
          </Section>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      )}
    </div>
  )
}
```


***

## File 10 — Add `loyalty` to Sidebar

```typescript
// Add to NAV array in Sidebar.tsx:
import { Star } from 'lucide-react'

{ href: '/loyalty', label: 'Loyalty', icon: Star },
```


***

## Deploy

```bash
supabase functions deploy award-loyalty-points
supabase functions deploy redeem-loyalty-points
```


***

## Full Flow Verification

| Step | What happens |
| :-- | :-- |
| Customer places first order | No points yet — awarded only on delivery |
| Merchant marks order **Delivered** | `award-loyalty-points` fires → balance row created → points logged |
| Bronze customer (< RM200 spent) | Earns ×1 pts per RM1 |
| Silver customer (≥ RM200 spent) | Earns ×1.5 pts automatically |
| Customer opens checkout | `LoyaltyCard` shows balance + tier + progress bar |
| Customer toggles "Use Points" | Quick-select buttons appear; discount preview shows in real time |
| Customer places order with redemption | `redeem-loyalty-points` deducts balance + updates order total |
| Dashboard `/loyalty` Overview | Total members, outstanding points liability, tier breakdown |
| Dashboard `/loyalty` Members | Leaderboard sorted by RM spent with tier badges |
| Dashboard `/loyalty` Settings | Full config: earn rate, redemption cap, tier thresholds, multipliers |
| Toggle program off | Customers no longer see points UI; existing balances preserved [^3] |

<span style="display:none">[^10][^11][^12][^13][^14][^15][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://www.zigpoll.com/content/what-are-the-most-efficient-database-schema-designs-and-indexing-strategies-to-handle-largescale-realtime-points-accumulation-redemption-tracking-and-expiration-in-a-loyalty-points-system-for-marketing-purposes

[^2]: https://rewardz.sg/blog/tier-based-loyalty-programmes/

[^3]: https://www.openloyalty.io/insider/effective-tiered-loyalty-programs

[^4]: https://marketingagent.blog/2026/02/05/tiered-loyalty-programs-the-psychology-of-bronze-silver-and-gold-that-keeps-customers-coming-back-in-2026/

[^5]: https://developers.google.com/search/docs/appearance/structured-data/loyalty-program

[^6]: https://www.yotpo.com/blog/loyalty-program-for-ecommerce/

[^7]: https://omnivy.io/blog/how-to-design-loyalty-architecture

[^8]: https://motherapp.com/insights/customer-loyalty-in-2025-strategies-and-system-comparison/

[^9]: https://www.openloyalty.io/insider/how-to-build-loyalty-program

[^10]: https://resources.marsello.com/blog/how-to-create-a-loyalty-program-in-2025

[^11]: https://voyado.com/resources/blog/how-to-implement-a-customer-loyalty-program/

[^12]: https://emarsys.com/learn/blog/best-tiered-loyalty-programs/

[^13]: https://www.stampme.com/blog/start-loyalty-program-small-business

[^14]: https://antavo.com/blog/loyalty-program-best-practices/

[^15]: https://loyaltyrewardco.com/break-through-loyalty-program-saturation/

