'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function getMerchantId(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!merchant) throw new Error('Merchant not found')
  return merchant.id
}

export async function getPurchaseOrders(filters?: { status?: string, dateFrom?: string, dateTo?: string }) {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  let query = supabase
    .from('purchase_orders')
    .select('*, suppliers(name)')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.dateFrom) query = query.gte('order_date', filters.dateFrom)
  if (filters?.dateTo) query = query.lte('order_date', filters.dateTo)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getPurchaseOrder(id: string) {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, suppliers(*), purchase_order_items(*, products(name))')
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .single()

  if (error) throw error
  return data
}

export async function createPurchaseOrder(params: {
  supplier_id: string
  outlet_id?: string
  expected_date?: string
  notes?: string
  items: Array<{
    product_id: string
    variant_id?: string
    quantity_ordered: number
    unit_cost: number
  }>
}) {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  // 1. Generate PO number
  const { data: po_number, error: poError } = await supabase
    .rpc('generate_po_number', { p_merchant_id: merchantId })
  if (poError) throw poError

  // 2. Create PO
  const subtotal = params.items.reduce((acc, item) => acc + (item.quantity_ordered * item.unit_cost), 0)
  const total = subtotal // Basic calculation

  const { data: po, error: createError } = await supabase
    .from('purchase_orders')
    .insert({
      merchant_id: merchantId,
      po_number,
      supplier_id: params.supplier_id,
      outlet_id: params.outlet_id,
      expected_date: params.expected_date,
      notes: params.notes,
      subtotal,
      total,
      status: 'draft'
    })
    .select()
    .single()

  if (createError) throw createError

  // 3. Create items
  const itemsToInsert = params.items.map(item => ({
    po_id: po.id,
    product_id: item.product_id,
    variant_id: item.variant_id || null,
    quantity_ordered: item.quantity_ordered,
    unit_cost: item.unit_cost,
    total: item.quantity_ordered * item.unit_cost
  }))

  const { error: itemError } = await supabase
    .from('purchase_order_items')
    .insert(itemsToInsert)

  if (itemError) throw itemError

  revalidatePath('/inventory/purchase-orders')
  return po
}

export async function updatePurchaseOrder(id: string, params: any) {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  const { data, error } = await supabase
    .from('purchase_orders')
    .update({ ...params, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .select()
    .single()

  if (error) throw error
  revalidatePath('/inventory/purchase-orders')
  return data
}

export async function sendPurchaseOrder(id: string) {
  return updatePurchaseOrder(id, { status: 'sent', order_date: new Date().toISOString() })
}

export async function cancelPurchaseOrder(id: string) {
  return updatePurchaseOrder(id, { status: 'cancelled' })
}

export async function receiveGoods(poId: string, items: Array<{ po_item_id: string, quantity: number }>, notes?: string) {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // 1. Create Goods Receipt
  const { data: receipt, error: receiptError } = await supabase
    .from('goods_receipts')
    .insert({
      po_id: poId,
      merchant_id: merchantId,
      received_by: user.id,
      notes
    })
    .select()
    .single()

  if (receiptError) throw receiptError

  // 2. Call RPC to update PO items and stock
  const { error: rpcError } = await supabase.rpc('receive_goods', {
    p_receipt_id: receipt.id,
    p_items: items
  })

  if (rpcError) throw rpcError

  revalidatePath('/inventory/purchase-orders')
  revalidatePath('/products')
  return receipt
}

export async function createDraftPOFromSuggestions(suggestions: any[]) {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  // Group by supplier
  const supplierGroups = suggestions.reduce((acc, sug) => {
    if (!sug.preferred_supplier_id) return acc
    if (!acc[sug.preferred_supplier_id]) acc[sug.preferred_supplier_id] = []
    acc[sug.preferred_supplier_id].push(sug)
    return acc
  }, {})

  const createdPos = []

  for (const supplierId in supplierGroups) {
    const items = supplierGroups[supplierId]
    const po = await createPurchaseOrder({
      supplier_id: supplierId,
      notes: 'Auto-generated from reorder suggestions',
      items: items.map((i: any) => ({
        product_id: i.product_id,
        variant_id: i.variant_id,
        quantity_ordered: i.suggested_qty,
        unit_cost: i.unit_cost || 0
      }))
    })
    createdPos.push(po)
  }

  return createdPos
}
