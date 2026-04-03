import { getMerchant } from '@/lib/utils.server'
import { CustomersClient } from '@/components/dashboard/CustomersClient'
import { subDays, format } from 'date-fns'

function toDate(s: string | undefined, fallback: Date) {
  if (!s) return fallback
  const d = new Date(s); return isNaN(d.getTime()) ? fallback : d
}

export default async function CustomersPage({
  searchParams,
}: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { from, to } = await searchParams
  const { supabase, merchant } = await getMerchant()
  const endDate   = toDate(to,   new Date())
  const startDate = toDate(from, subDays(endDate, 29))
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

  const [
    { data: overviewStats },
    { data: customerKpis },
    { data: segments },
    { data: cohorts },
    { data: patterns },
    { data: abandonmentStats },
    { data: satisfactionSummary },
    { data: reviews },
    { data: newTrend },
  ] = await Promise.all([
    supabase.rpc('get_customer_overview_stats', { p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate) }),
    supabase.rpc('get_customer_kpi_list',       { p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate), p_limit: 100 }),
    supabase.rpc('get_customer_segments_rfm',   { p_merchant_id: merchant.id }),
    supabase.rpc('get_retention_cohorts',       { p_merchant_id: merchant.id, p_months: 6 }),
    supabase.rpc('get_purchase_patterns',       { p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate) }),
    supabase.rpc('get_cart_abandonment_stats',  { p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate) }),
    supabase.rpc('get_satisfaction_summary',    { p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate) }),
    supabase.from('order_reviews')
      .select('*, customer:customer_id(full_name), order:order_id(order_number)')
      .eq('merchant_id', merchant.id)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.rpc('get_new_customer_trend',      { p_merchant_id: merchant.id, p_start: fmt(startDate), p_end: fmt(endDate) }),
  ])

  // Fetch all unique customer IDs from loyalty_points and orders for this merchant
  const [ { data: loyaltyCusts }, { data: orderCusts } ] = await Promise.all([
    supabase.from('loyalty_points').select('customer_id').eq('merchant_id', merchant.id),
    supabase.from('orders').select('customer_id').eq('merchant_id', merchant.id),
  ])

  const associatedIds = Array.from(new Set([
    ...(loyaltyCusts?.map(l => l.customer_id) ?? []),
    ...(orderCusts?.map(o => o.customer_id)   ?? []),
  ]))

  const { data: allCustomers } = associatedIds.length > 0 
    ? await supabase.from('profiles').select('*').in('id', associatedIds).order('created_at', { ascending: false })
    : { data: [] }

  return (
    <CustomersClient
      merchantId={merchant.id}
      dateRange={{ from: fmt(startDate), to: fmt(endDate) }}
      overview={(overviewStats as any)?.[0] ?? {}}
      customerKpis={(customerKpis  as any[]) ?? []}
      segments={(segments          as any[]) ?? []}
      cohorts={(cohorts            as any[]) ?? []}
      patterns={(patterns          as any[]) ?? []}
      abandonmentStats={(abandonmentStats as any)?.[0] ?? {}}
      satisfactionSummary={(satisfactionSummary as any)?.[0] ?? {}}
      reviews={(reviews            as any[]) ?? []}
      newTrend={(newTrend          as any[]) ?? []}
      allCustomers={(allCustomers  as any[]) ?? []}
    />
  )
}

