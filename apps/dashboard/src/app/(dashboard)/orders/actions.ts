'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { postOrderSale } from '@project1/accounting'

export async function updateOrderStatusServer(orderId: string, newStatus: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // 1. Fetch current order to get details for accounting & validation
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select(`
      *,
      items:order_items(*, product:products(cost_price))
    `)
    .eq('id', orderId)
    .single()

  if (fetchError || !order) throw new Error('Order not found')

  const now = new Date().toISOString()
  const updates: any = { status: newStatus, updated_at: now }

  if (newStatus === 'confirmed') updates.confirmed_at = now
  if (newStatus === 'preparing') updates.preparing_at = now
  if (newStatus === 'ready_for_pickup') updates.ready_at = now
  if (newStatus === 'delivered') updates.delivered_at = now
  if (newStatus === 'cancelled') updates.cancelled_at = now

  // Special case: if marking as Paid manually
  if (newStatus === 'paid') {
    updates.payment_status = 'paid'
    updates.paid_at = now
  }

  const { data: updatedOrder, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', orderId)
    .select()
    .single()

  if (error) throw error

  // --- ACCOUNTING INTEGRATION ---
  // If the order is becoming PAID, we record the sale.
  // Or if it was already paid and we are just confirming it.
  if (newStatus === 'paid' || (newStatus === 'confirmed' && order.payment_status === 'paid')) {
    try {
      // Calculate COGS
      const totalCogs = (order.items || []).reduce((sum: number, item: any) => {
        return sum + (Number(item.product?.cost_price || 0) * item.quantity)
      }, 0)

      await postOrderSale({
        merchantId: order.merchant_id,
        orderId:    order.id,
        orderNo:    order.order_number,
        total:      Number(order.total_amount),
        subtotal:   Number(order.subtotal),
        tax:        Number(order.tax_amount || 0),
        delivery:   Number(order.delivery_fee || 0),
        discount:   Number(order.discount_amount || 0),
        cogs:       totalCogs,
        date:       new Date(),
        paymentMethod: order.payment_method,
        isMarketplace: !!order.marketplace_order_id || !!order.external_id
      })
    } catch (accError) {
      console.error('Order Accounting Sync Failed:', accError)
    }
  }

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')
  return updatedOrder
}
