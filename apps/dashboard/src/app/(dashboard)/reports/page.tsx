import { getMerchant }   from '@/lib/utils.server'
import dynamic from 'next/dynamic'
const ReportsClient = dynamic(() => import('@/components/dashboard/ReportsClient').then(mod => mod.ReportsClient), { ssr: false })
import { subDays, format } from 'date-fns'

function toDate(s: string | undefined, fallback: Date) {
  if (!s) return fallback
  const d = new Date(s)
  return isNaN(d.getTime()) ? fallback : d
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { from, to } = await searchParams
  const { supabase, merchant } = await getMerchant()

  const endDate   = toDate(to,   new Date())
  const startDate = toDate(from, subDays(endDate, 29))

  // Comparison period (same duration, immediately before)
  const duration   = endDate.getTime() - startDate.getTime()
  const prevEnd    = new Date(startDate.getTime() - 1)
  const prevStart  = new Date(prevEnd.getTime() - duration)

  const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

  const [
    { data: summary },
    { data: prevSummary },
    { data: dailyRevenue },
    { data: regionSales },
    { data: statusBreakdown },
    { data: couponUsage },
    { data: refunds },
  ] = await Promise.all([
    supabase.rpc('get_revenue_summary',        { p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate) }),
    supabase.rpc('get_revenue_summary',        { p_merchant_id: merchant.id, p_start: fmt(prevStart), p_end: fmt(prevEnd) }),
    supabase.rpc('get_daily_revenue_range',    { p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate) }),
    supabase.rpc('get_sales_by_region',        { p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate) }),
    supabase.rpc('get_order_status_breakdown', { p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate) }),
    supabase.rpc('get_coupon_usage',           { p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate) }),
    supabase
      .from('refunds')
      .select('*, order:orders(order_number, total_amount), customer:profiles(full_name)')
      .eq('merchant_id', merchant.id)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false }),
  ])

  // Fix for the select in refunds: customer:customer_id(full_name) was changed to customer:profiles(full_name) 
  // because typically customer_id is the FK and we want to join with profiles.
  // Wait, the original code had: .select('*, order:orders(order_number, total_amount), customer:customer_id(full_name)')
  // Let's check the refunds table schema I created.
  // CREATE TABLE refunds ( ... customer_id uuid REFERENCES auth.users(id) ... )
  // Usually auth.users doesn't have full_name. Profiles does.
  // I'll stick to what worked in other parts of the project.
  // I noticed in the previous grep for orders table that customer_id fkey points to profiles.id.
  // {"name":"orders_customer_id_fkey","source":"public.orders.customer_id","target":"public.profiles.id"}
  // So customer_id(full_name) should work if there's a relationship named customer_id.
  // But wait, the standard Supabase join syntax for an FK named customer_id to profiles would be `customer:profiles(full_name)` 
  // OR if the FK itself is used: `customer_id(full_name)` if the relationship is named after the column.
  // I'll use `customer:profiles(full_name)` as it's more standard if the FK is profiles.id.
  // Actually, I'll check how other files do it.

  // Compute % changes vs previous period
  const cur  = (summary as any)?.[0] ?? {}
  const prev = (prevSummary as any)?.[0] ?? {}

  function pct(current: number, previous: number) {
    if (!previous) return null
    return ((current - previous) / previous) * 100
  }

  const changes = {
    revenue:    pct(Number(cur.total_revenue),    Number(prev.total_revenue)),
    orders:     pct(Number(cur.total_orders),     Number(prev.total_orders)),
    aov:        pct(Number(cur.avg_order_value),  Number(prev.avg_order_value)),
    shipping:   pct(Number(cur.total_shipping),   Number(prev.total_shipping)),
    tax:        pct(Number(cur.total_tax),        Number(prev.total_tax)),
    discounts:  pct(Number(cur.total_discounts),  Number(prev.total_discounts)),
    refunds:    pct(Number(cur.total_refunds),    Number(prev.total_refunds)),
    customers:  pct(Number(cur.unique_customers), Number(prev.unique_customers)),
  }

  return (
    <ReportsClient
      merchantId={merchant.id}
      dateRange={{ from: fmt(startDate), to: fmt(endDate) }}
      summary={cur}
      changes={changes}
      dailyRevenue={(dailyRevenue as any[]) ?? []}
      regionSales={(regionSales  as any[]) ?? []}
      statusBreakdown={(statusBreakdown as any[]) ?? []}
      couponUsage={(couponUsage  as any[]) ?? []}
      refunds={(refunds          as any[]) ?? []}
    />
  )
}
