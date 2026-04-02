import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { OrderDetailClient } from '@/components/dashboard/OrderDetailClient'

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!merchant) redirect('/login')

  const { data: order } = await supabase
    .from('orders')
    .select(`
      *,
      items:order_items(*),
      customer:profiles!customer_id(id, full_name, phone)
    `)
    .eq('id', id)
    .eq('merchant_id', merchant.id)
    .single()

  if (!order) notFound()

  // Map customer_note to notes for component compatibility
  const orderWithNotes = {
    ...order,
    notes: order.customer_note
  }

  // Customer's previous orders with this merchant
  const { count: customerOrderCount } = order.customer_id
    ? await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('merchant_id', merchant.id)
        .eq('customer_id', order.customer_id)
    : { count: 0 }

  return (
    <OrderDetailClient
      order={orderWithNotes}
      merchantId={merchant.id}
      customerOrderCount={customerOrderCount ?? 0}
    />
  )
}
