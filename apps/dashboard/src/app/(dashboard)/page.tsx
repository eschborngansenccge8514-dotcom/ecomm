import { createClient }    from '@/lib/supabase/server'
import { StatCard }        from '@/components/dashboard/StatCard'
import { RevenueChart }    from '@/components/dashboard/RevenueChart'
import { RecentOrders }    from '@/components/dashboard/RecentOrders'
import { redirect }        from 'next/navigation'
import { formatCurrency }  from '@/lib/utils'
import { TrendingUp, ShoppingBag, Package, Clock } from 'lucide-react'
import { MonitoringDashboard } from '@/components/monitoring/MonitoringDashboard'

async function getDashboardData(merchantId: string) {
  const supabase = await createClient()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfLast  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const endOfLast    = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()

  // All 6 queries run in parallel — previously get_daily_revenue was sequential
  const [
    { data: thisMonth },
    { data: lastMonth },
    { data: recentOrders },
    { data: products },
    { count: pendingCount },
    { data: dailyRevenue },
  ] = await Promise.all([
    supabase.from('orders').select('total_amount, status')
      .eq('merchant_id', merchantId).gte('created_at', startOfMonth),
    supabase.from('orders').select('total_amount')
      .eq('merchant_id', merchantId)
      .gte('created_at', startOfLast).lte('created_at', endOfLast),
    supabase.from('orders').select('*')
      .eq('merchant_id', merchantId).order('created_at', { ascending: false }).limit(5),
    supabase.from('products').select('id, status')
      .eq('merchant_id', merchantId),
    supabase.from('orders').select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId).eq('status', 'paid'),
    supabase.rpc('get_daily_revenue', { p_merchant_id: merchantId, p_days: 30 }),
  ])

  const thisRevenue = (thisMonth ?? []).reduce((s, o) => s + Number(o.total_amount), 0)
  const lastRevenue = (lastMonth ?? []).reduce((s, o) => s + Number(o.total_amount), 0)
  const revGrowth   = lastRevenue > 0 ? ((thisRevenue - lastRevenue) / lastRevenue) * 100 : 0

  return {
    thisRevenue,
    revGrowth,
    orderCount:      (thisMonth ?? []).length,
    activeProducts:  (products ?? []).filter(p => p.status === 'active').length,
    pendingCount:    pendingCount ?? 0,
    recentOrders:    recentOrders ?? [],
    dailyRevenue:    dailyRevenue ?? [],
  }
}

export default async function OverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants').select('id').eq('owner_id', user.id).single()
  if (!merchant) redirect('/login')

  const data = await getDashboardData(merchant.id)

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Revenue This Month"
          value={formatCurrency(data.thisRevenue)}
          change={`${data.revGrowth >= 0 ? '+' : ''}${data.revGrowth.toFixed(1)}% vs last month`}
          positive={data.revGrowth >= 0}
          icon={<TrendingUp size={20} />}
          iconBg="bg-blue-100" iconColor="text-blue-600"
        />
        <StatCard
          title="Orders This Month"
          value={String(data.orderCount)}
          icon={<ShoppingBag size={20} />}
          iconBg="bg-purple-100" iconColor="text-purple-600"
        />
        <StatCard
          title="Active Products"
          value={String(data.activeProducts)}
          icon={<Package size={20} />}
          iconBg="bg-green-100" iconColor="text-green-600"
        />
        <StatCard
          title="Pending Orders"
          value={String(data.pendingCount)}
          alert={data.pendingCount > 0}
          icon={<Clock size={20} />}
          iconBg="bg-amber-100" iconColor="text-amber-600"
        />
      </div>

      {/* Charts + recent orders */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <RevenueChart data={data.dailyRevenue} />
        </div>
        <div>
          <RecentOrders orders={data.recentOrders} merchantId={merchant.id} />
        </div>
      </div>

      {/* Real-time Monitoring Section */}
      <div className="mt-8 border-t pt-8">
        <MonitoringDashboard merchantId={merchant.id} />
      </div>
    </div>
  )
}
