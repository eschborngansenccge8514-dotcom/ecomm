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
      .select('customer_id, balance, total_earned, total_spent_rm, tier, updated_at, profiles:customer_id(full_name)')
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
  ;(stats ?? []).forEach((r: any) => { 
    if (tierCounts[r.tier as keyof typeof tierCounts] !== undefined) {
      tierCounts[r.tier as keyof typeof tierCounts]++ 
    }
  })

  return (
    <div className="pb-10">


      <LoyaltyClient
        settings={settings}
        topCustomers={topCustomers ?? []}
        recentTransactions={recentTxns ?? []}
        merchantId={merchant.id}
        statsSummary={{ totalMembers, totalOutstanding, tierCounts }}
      />
    </div>
  )
}
