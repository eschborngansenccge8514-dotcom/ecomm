import { getAuthContext } from '@/lib/utils.server'
import { notFound, redirect } from 'next/navigation'
import { OrderDetailClient } from '@/components/dashboard/OrderDetailClient'

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, merchant, isAdmin } = await getAuthContext()

  const effectiveMerchantId = merchant?.id || 'admin'

  let orderQuery = supabase
    .from('orders')
    .select(`
      *,
      items:order_items(*),
      customer:profiles!customer_id(id, full_name, phone)
    `)
    .eq('id', id)

  if (merchant) {
    orderQuery = orderQuery.eq('merchant_id', merchant.id)
  }

  const { data: order } = await orderQuery.single()

  if (!order) notFound()

  // Map customer_note to notes for component compatibility
  const orderWithNotes = {
    ...order,
    notes: order.customer_note
  }

  // Customer's previous orders with this merchant
  let customerOrderQuery = supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', order.customer_id)

  if (merchant) {
    customerOrderQuery = customerOrderQuery.eq('merchant_id', merchant.id)
  }

  const { count: customerOrderCount } = order.customer_id
    ? await customerOrderQuery
    : { count: 0 }

  return (
    <OrderDetailClient
      order={orderWithNotes}
      merchantId={effectiveMerchantId}
      customerOrderCount={customerOrderCount ?? 0}
    />
  )
}
