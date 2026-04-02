import { createClient }  from '@/lib/supabase/server'
import { redirect }      from 'next/navigation'
import { OrdersTable }   from '@/components/dashboard/OrdersTable'

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const { status = 'all', page = '1' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants').select('id').eq('owner_id', user.id).single()
  if (!merchant) redirect('/login')

  const PAGE_SIZE = 20
  const offset    = (Number(page) - 1) * PAGE_SIZE

  let query = supabase
    .from('orders')
    .select('*, items:order_items(product_name, quantity, line_total)', { count: 'exact' })
    .eq('merchant_id', merchant.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (status !== 'all') query = query.eq('status', status)

  const { data: orders, count } = await query

  return (
    <OrdersTable
      orders={orders ?? []}
      total={count ?? 0}
      page={Number(page)}
      pageSize={PAGE_SIZE}
      currentStatus={status}
      merchantId={merchant.id}
    />
  )
}
