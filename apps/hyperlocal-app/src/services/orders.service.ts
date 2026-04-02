import { supabase } from '@/lib/supabase'
import type { InsertOrder, OrderWithItems } from '@/types/app.types'

export const ordersService = {
  // Customer: get all own orders
  async getMyOrders(customerId: string): Promise<OrderWithItems[]> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*),
        merchant:merchants(id, store_name, logo_url)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as unknown as OrderWithItems[]
  },

  // Merchant: get all store orders
  async getMerchantOrders(merchantId: string, status?: string): Promise<OrderWithItems[]> {
    let query = supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*),
        merchant:merchants(id, store_name, logo_url)
      `)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status as any)
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as unknown as OrderWithItems[]
  },

  // Get single order
  async getById(id: string): Promise<OrderWithItems | null> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(*),
        merchant:merchants(id, store_name, logo_url)
      `)
      .eq('id', id)
      .single()
    if (error) return null
    return data as unknown as OrderWithItems
  },

  // Create order (from checkout)
  async create(order: InsertOrder, items: Array<{
    product_id: string
    variant_id?: string | null
    product_name: string
    variant_name?: string | null
    unit_price: number
    quantity: number
    line_total: number
  }>): Promise<OrderWithItems> {
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert(order)
      .select()
      .single()
    if (orderError) throw orderError

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(items.map(i => ({ ...i, order_id: newOrder.id })))
    if (itemsError) throw itemsError

    return ordersService.getById(newOrder.id) as Promise<OrderWithItems>
  },

  // Merchant: update order status
  async updateStatus(id: string, status: string, note?: string): Promise<void> {
    const { error } = await supabase
      .from('orders')
      .update({ 
        status: status as any, 
        merchant_note: note ?? null 
      })
      .eq('id', id)
    if (error) throw error
  },
}
