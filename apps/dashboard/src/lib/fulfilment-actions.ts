'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createFulfilment(orderId: string, items: { order_item_id: string, quantity: number, product_id?: string, variant_id?: string, barcode?: string }[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // 1. Get merchant_id
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  
  if (!merchant) throw new Error('Merchant not found')

  // 2. Generate fulfilment number
  const { data: fulfilmentNumber, error: fnError } = await supabase
    .rpc('generate_fulfilment_number', { p_merchant_id: merchant.id })
  
  if (fnError) throw fnError

  // 3. Create fulfilment record
  const { data: fulfilment, error: fError } = await supabase
    .from('fulfilments')
    .insert({
      merchant_id: merchant.id,
      order_id: orderId,
      fulfilment_number: fulfilmentNumber,
      status: 'pending',
      created_by: user.id
    })
    .select()
    .single()
  
  if (fError) throw fError

  // 4. Create fulfilment items
  const fulfilmentItems = items.map(item => ({
    fulfilment_id: fulfilment.id,
    order_item_id: item.order_item_id,
    product_id: item.product_id,
    variant_id: item.variant_id,
    quantity: item.quantity,
    barcode: item.barcode
  }))

  const { error: fiError } = await supabase
    .from('fulfilment_items')
    .insert(fulfilmentItems)
  
  if (fiError) throw fiError

  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/orders')
  revalidatePath('/fulfilment')
  return fulfilment
}

export async function updateFulfilmentStatus(
  fulfilmentId: string, 
  newStatus: string, 
  details?: { tracking_number?: string, courier?: string, shipping_label_url?: string, notes?: string }
) {
  const supabase = await createClient()
  const updateData: any = { 
    status: newStatus,
    updated_at: new Date().toISOString()
  }

  if (newStatus === 'picking') updateData.picked_at = null // Reset if going back
  if (newStatus === 'picked') updateData.picked_at = new Date().toISOString()
  if (newStatus === 'packing') updateData.packed_at = null
  if (newStatus === 'packed') updateData.packed_at = new Date().toISOString()
  if (newStatus === 'shipped') updateData.shipped_at = new Date().toISOString()
  if (newStatus === 'delivered') updateData.delivered_at = new Date().toISOString()

  if (details) {
    if (details.tracking_number) updateData.tracking_number = details.tracking_number
    if (details.courier) updateData.courier = details.courier
    if (details.shipping_label_url) updateData.shipping_label_url = details.shipping_label_url
    if (details.notes) updateData.notes = details.notes
  }

  const { data: fulfilment, error } = await supabase
    .from('fulfilments')
    .update(updateData)
    .eq('id', fulfilmentId)
    .select('order_id')
    .single()
  
  if (error) throw error

  // Always evaluate order fulfilment status
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('id, quantity')
    .eq('order_id', fulfilment.order_id)
  
  const { data: validFulfilments } = await supabase
    .from('fulfilments')
    .select('id')
    .eq('order_id', fulfilment.order_id)
    .in('status', ['shipped', 'delivered'])

  const validFulfilmentIds = validFulfilments?.map(f => f.id) || []

  let totalFulfilled = 0
  if (validFulfilmentIds.length > 0) {
    const { data: allFulfilledItems } = await supabase
      .from('fulfilment_items')
      .select('quantity')
      .in('fulfilment_id', validFulfilmentIds)
    
    totalFulfilled = allFulfilledItems?.reduce((sum, item) => sum + item.quantity, 0) || 0
  }

  const totalOrdered = orderItems?.reduce((sum, item) => sum + item.quantity, 0) || 0

  let orderStatus = 'partially_fulfilled'
  if (totalFulfilled >= totalOrdered) orderStatus = 'fulfilled'
  if (totalFulfilled === 0) orderStatus = 'unfulfilled'

  await supabase
    .from('orders')
    .update({ fulfilment_status: orderStatus })
    .eq('id', fulfilment.order_id)

  revalidatePath(`/orders/${fulfilment.order_id}`)
  revalidatePath('/orders')
  revalidatePath('/fulfilment')
  return { success: true }
}

export async function getFulfilments(orderId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fulfilments')
    .select(`
      *,
      fulfilment_items (
        *,
        product:products(name, sku),
        variant:product_variants(name, sku)
      )
    `)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data
}

export async function verifyPickByBarcode(fulfilmentId: string, barcode: string) {
  const supabase = await createClient()
  
  // Find item in fulfilment with this barcode
  const { data: items, error } = await supabase
    .from('fulfilment_items')
    .select('id, picked')
    .eq('fulfilment_id', fulfilmentId)
    .eq('barcode', barcode)
    .eq('picked', false)
    .limit(1)
  
  if (error) throw error
  if (!items || items.length === 0) return { success: false, message: 'Barcode not found or already picked' }

  const { error: updateError } = await supabase
    .from('fulfilment_items')
    .update({ picked: true })
    .eq('id', items[0].id)
  
  if (updateError) throw updateError

  return { success: true }
}

export async function batchCreateFulfilments(orderIds: string[]) {
  const supabase = await createClient()
  const results = []

  for (const orderId of orderIds) {
    try {
      // Get unfulfilled items for this order
      const { data: items } = await supabase
        .from('order_items')
        .select('id, quantity, product_id, variant_id')
        .eq('order_id', orderId)
      
      if (!items || items.length === 0) continue

      // For batch, we'll just assume full fulfilment of what's unfulfilled
      // Simplification: just take order items (in production we'd subtract existing fulfilment_items)
      const fulfilmentItems = items.map(item => ({
        order_item_id: item.id,
        quantity: item.quantity,
        product_id: item.product_id,
        variant_id: item.variant_id
      }))

      const f = await createFulfilment(orderId, fulfilmentItems)
      results.push(f)
    } catch (err) {
      console.error(`Failed to batch fulfil order ${orderId}:`, err)
    }
  }

  return results
}
