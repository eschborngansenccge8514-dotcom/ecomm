import { getAuthContext } from '@/lib/utils.server'
import { redirect }      from 'next/navigation'
import { OrdersTable }   from '@/components/dashboard/OrdersTable'

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; search?: string }>
}) {
  const { status = 'all', page = '1', search = '' } = await searchParams
  const { supabase, user, merchant, isAdmin } = await getAuthContext()

  // Use a virtual merchant ID for admins for display purposes
  const effectiveMerchantId = merchant?.id || 'admin'

  // Fetch summary stats
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const statsQuery         = supabase.from('orders').select('*', { count: 'exact', head: true })
  const pendingStatsQuery = supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['pending', 'paid'])
  const revenueQuery       = supabase.from('orders').select('total_amount').gte('created_at', today.toISOString())
  
  if (merchant) {
    statsQuery.eq('merchant_id', merchant.id)
    pendingStatsQuery.eq('merchant_id', merchant.id)
    revenueQuery.eq('merchant_id', merchant.id)
  }

  const [
    { count: totalCount },
    { count: pendingCount },
    { data: revenueData },
    { data: merchantData },
    { data: einvoiceConfig },
    { data: statusCountsData },
    { data: fulfilments, error: fulfilmentsError }
  ] = await Promise.all([
    statsQuery,
    pendingStatsQuery,
    revenueQuery,
    merchant ? supabase.from('merchants').select('*').eq('id', merchant.id).single() : Promise.resolve({ data: null }),
    merchant ? supabase.from('merchant_einvoice_config').select('*').eq('merchant_id', merchant.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.rpc('get_order_status_counts', { p_merchant_id: merchant?.id || null }),
    merchant
      ? supabase.from('fulfilments')
          .select(`
            *,
            order:orders(order_number, buyer_name),
            fulfilment_items(*, product:products(name, sku), variant:product_variants(name, sku))
          `)
          .eq('merchant_id', merchant.id)
          .in('status', ['pending', 'picking', 'picked', 'packing', 'packed', 'shipped'])
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null })
  ])

  const revenueToday = (revenueData || []).reduce((acc, curr) => acc + Number(curr.total_amount), 0)
  const statusCounts = (statusCountsData || []).reduce((acc: any, curr: any) => {
    acc[curr.status] = curr.count
    return acc
  }, {})

  const PAGE_SIZE = 20
  const offset    = (Number(page) - 1) * PAGE_SIZE

  let query = supabase
    .from('orders')
    .select(`
      id, order_number, status, payment_method, delivery_type, 
      delivery_provider, driver_name, tracking_number, created_at, 
      buyer_name, delivery_address, total_amount, delivery_status, 
      delivery_tracking_url, fulfilment_status,
      items:order_items(product_name, quantity, variant_name, line_total, unit_price),
      einvoices!einvoices_order_id_fkey(status, lhdn_long_id, submission_uid)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (merchant) {
    query = query.eq('merchant_id', merchant.id)
  }

  if (status !== 'all') query = query.eq('status', status)
  
  if (search) {
    query = query.or(`order_number.ilike.%${search}%,buyer_name.ilike.%${search}%`)
  }

  const { data: orders, count, error: ordersError } = await query
  if (ordersError) console.error('Orders Query Error:', ordersError)

  console.log('OrdersPage:', {
    merchantId: merchant?.id,
    isAdmin,
    ordersCount: orders?.length,
    totalCount: count,
    statusFilter: status,
    hasError: !!ordersError,
    fulfilmentsCount: fulfilments?.length ?? 'null',
    fulfilmentsError: fulfilmentsError?.message ?? null,
  })

  return (
    <OrdersTable
      orders={orders ?? []}
      initialFulfilments={fulfilments || []}
      total={count ?? 0}
      page={Number(page)}
      pageSize={PAGE_SIZE}
      currentStatus={status}
      merchantId={effectiveMerchantId}
      merchant={merchantData}
      merchantEinvoiceConfig={einvoiceConfig}
      stats={{
        total: totalCount ?? 0,
        pending: pendingCount ?? 0,
        revenueToday: revenueToday
      }}
      statusCounts={statusCounts}
    />
  )
}

