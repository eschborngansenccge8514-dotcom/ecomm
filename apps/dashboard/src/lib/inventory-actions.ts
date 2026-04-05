'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type MovementType = 'sale' | 'restock' | 'return' | 'adjustment' | 'damaged' | 'lost'

export async function adjustInventory(params: {
  productId: string
  variantId?: string | null
  quantityDelta: number
  type: MovementType
  reason?: string
  outletId?: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get merchant_id
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!merchant) throw new Error('Merchant not found')

  const { data, error } = await supabase
    .from('inventory_movements')
    .insert({
      merchant_id: merchant.id,
      product_id: params.productId,
      variant_id: params.variantId || null,
      quantity_delta: params.quantityDelta,
      type: params.type,
      reason: params.reason,
      outlet_id: params.outletId || null
    })
    .select()
    .single()

  if (error) throw error

  revalidatePath('/products')
  revalidatePath('/operations')
  return data
}

export async function getInventoryHistory(productId: string, variantId?: string | null) {
  const supabase = await createClient()
  
  let query = supabase
    .from('inventory_movements')
    .select(`
      *,
      pos_transactions (receipt_number),
      orders (order_number)
    `)
    .eq('product_id', productId)
    .order('created_at', { ascending: false })

  if (variantId) {
    query = query.eq('variant_id', variantId)
  } else {
    query = query.is('variant_id', null)
  }

  const { data, error } = await query.limit(50)
  if (error) throw error
  return data
}

export async function getLowStockAlerts() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!merchant) return []

  const { data, error } = await supabase
    .from('products')
    .select('id, name, stock_quantity, low_stock_alert')
    .eq('merchant_id', merchant.id)
    .lte('stock_quantity', 5) // Default threshold
    .order('stock_quantity', { ascending: true })

  if (error) throw error
  return data
}
