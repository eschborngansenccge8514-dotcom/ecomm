import { getMerchant }  from '@/lib/utils.server'
import { subDays, startOfDay, format } from 'date-fns'
import { AnalyticsClient } from '@/components/dashboard/AnalyticsClient'

export default async function AnalyticsPage() {
  const { supabase, merchant } = await getMerchant()

  const since30 = subDays(new Date(), 30).toISOString()
  const since7  = subDays(new Date(), 7).toISOString()

  const [
    { data: orders30 },
    { data: topProducts },
    { data: dailyRevenue },
    { data: statusBreakdown },
    { data: hourlyOrders },
  ] = await Promise.all([
    // All orders last 30 days
    supabase.from('orders')
      .select('total_amount, status, created_at, delivery_type')
      .eq('merchant_id', merchant.id)
      .gte('created_at', since30)
      .not('status', 'in', '(pending,cancelled)'),

    // Top 10 products by revenue
    supabase.from('order_items')
      .select('product_name, quantity, line_total, order:orders!inner(merchant_id, created_at, status)')
      .eq('order.merchant_id', merchant.id)
      .gte('order.created_at', since30)
      .not('order.status', 'in', '(pending,cancelled)')
      .limit(200),

    // Daily revenue via RPC
    supabase.rpc('get_daily_revenue', { p_merchant_id: merchant.id, p_days: 30 }),

    // Status breakdown
    supabase.from('orders')
      .select('status')
      .eq('merchant_id', merchant.id)
      .gte('created_at', since30),

    // Hourly order distribution (last 7 days)
    supabase.from('orders')
      .select('created_at')
      .eq('merchant_id', merchant.id)
      .gte('created_at', since7)
      .not('status', 'eq', 'cancelled'),
  ])

  // Aggregate top products
  const productMap: Record<string, { name: string; revenue: number; units: number }> = {}
  ;(topProducts ?? []).forEach((item: any) => {
    if (!productMap[item.product_name]) {
      productMap[item.product_name] = { name: item.product_name, revenue: 0, units: 0 }
    }
    productMap[item.product_name].revenue += Number(item.line_total)
    productMap[item.product_name].units   += item.quantity
  })
  const topProductsArr = Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue).slice(0, 8)

  // Status breakdown
  const statusMap: Record<string, number> = {}
  ;(statusBreakdown ?? []).forEach((o: any) => {
    statusMap[o.status] = (statusMap[o.status] ?? 0) + 1
  })

  // Hourly distribution
  const hourMap: number[] = new Array(24).fill(0)
  ;(hourlyOrders ?? []).forEach((o: any) => {
    const hour = new Date(o.created_at).getHours()
    hourMap[hour]++
  })
  const hourlyData = hourMap.map((count, h) => ({
    hour: `${h.toString().padStart(2, '0')}:00`,
    orders: count,
  }))

  // Delivery type split
  const deliveryMap: Record<string, number> = {}
  ;(orders30 ?? []).forEach((o: any) => {
    const t = o.delivery_type ?? 'unknown'
    deliveryMap[t] = (deliveryMap[t] ?? 0) + 1
  })

  return (
    <AnalyticsClient
      dailyRevenue={dailyRevenue ?? []}
      topProducts={topProductsArr}
      statusBreakdown={Object.entries(statusMap).map(([k, v]) => ({ name: k, value: v }))}
      hourlyData={hourlyData}
      deliveryBreakdown={Object.entries(deliveryMap).map(([k, v]) => ({ name: k, value: v }))}
    />
  )
}
