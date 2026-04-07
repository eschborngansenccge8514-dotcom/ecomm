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

  // Helper to calculate progress to next tier
  getTierProgress: (totalSpentRM: number, settings: any) => {
    const silver   = Number(settings?.tier_silver_rm ?? 0)
    const gold     = Number(settings?.tier_gold_rm ?? 0)
    const platinum = Number(settings?.tier_platinum_rm ?? 0)

    if (totalSpentRM < silver)   return { next: 'Silver',   target: silver,   progress: totalSpentRM / (silver || 1) }
    if (totalSpentRM < gold)     return { next: 'Gold',     target: gold,     progress: (totalSpentRM - silver) / ((gold - silver) || 1) }
    if (totalSpentRM < platinum) return { next: 'Platinum', target: platinum, progress: (totalSpentRM - gold) / ((platinum - gold) || 1) }
    return { next: 'Maxed', target: platinum, progress: 1 }
  },
}
