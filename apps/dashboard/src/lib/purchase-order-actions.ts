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
    .select('*, suppliers(*), merchants(*), purchase_order_items(*, products(name)), goods_receipts(*, goods_receipt_items(*, products(name))), expenses(id, total_amount, payment_method, created_at, notes)')
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

export async function sendPurchaseOrder(id: string, method: 'email' | 'whatsapp' = 'email', base64Pdf?: string) {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  // 1. Fetch PO with supplier info
  const po = await getPurchaseOrder(id)
  
  if (method === 'email' && !po.suppliers?.email) {
    throw new Error(`Supplier "${po.suppliers?.name}" does not have an email address configured.`)
  }
  
  if (method === 'whatsapp' && !po.suppliers?.phone) {
    throw new Error(`Supplier "${po.suppliers?.name}" does not have a phone number configured.`)
  }

  // 2. Update status
  const updatedPo = await updatePurchaseOrder(id, { 
    status: 'sent', 
    order_date: new Date().toISOString() 
  })

  // 3. Trigger notification (best-effort)
  try {
    if (method === 'email') {
      const { error: emailError } = await supabase.functions.invoke('send-po-email', {
        body: { 
          po_id: id, 
          merchant_id: merchantId 
        }
      })
      if (emailError) console.error('[sendPurchaseOrder] Email error:', emailError)
    } else {
      // WhatsApp logic — using Evolution API
      const apiURL = process.env.EVOLUTION_API_URL
      const apiKey = process.env.EVOLUTION_API_KEY
      const instance = process.env.WHATSAPP_INSTANCE_NAME || 'Test'

      if (!apiURL || !apiKey) {
        console.error('[sendPurchaseOrder] Evolution API credentials missing')
        return
      }

      // Format phone: strip '+' and spaces for Evolution API
      const phone = po.suppliers.phone.replace(/\D/g, '')

      const textMessage = `*Purchase Order ${po.po_number || ''}*\n\nHello ${po.suppliers.name},\n\nWe have issued a new purchase order for RM ${po.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}.\n\nPlease find the attached Purchase Order document.\n\nPlease acknowledge receipt.\n\nThank you.`

      if (base64Pdf) {
        // Send Media (PDF) via Evolution API
        const response = await fetch(`${apiURL}/message/sendMedia/${instance}`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'apikey': apiKey 
          },
          body: JSON.stringify({
            number: phone,
            mediatype: 'document',
            mimetype: 'application/pdf',
            caption: textMessage,
            media: base64Pdf,
            fileName: `${po.po_number || 'Purchase_Order'}.pdf`
          })
        })
        
        if (!response.ok) {
          console.error('[sendPurchaseOrder] Evolution API media error:', await response.text())
        }
      } else {
        // Send Text via Evolution API (Fallback)
        const response = await fetch(`${apiURL}/message/sendText/${instance}`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'apikey': apiKey 
          },
          body: JSON.stringify({
            number: phone,
            text: textMessage
          })
        })
        
        if (!response.ok) {
          console.error('[sendPurchaseOrder] Evolution API text error:', await response.text())
        }
      }
    }
  } catch (err) {
    console.error('[sendPurchaseOrder] Error triggering notification:', err)
  }

  return updatedPo
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

export async function getGoodsReceipts() {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  const { data, error } = await supabase
    .from('goods_receipts')
    .select('*, purchase_orders(po_number, suppliers(name))')
    .eq('merchant_id', merchantId)
    .order('received_at', { ascending: false })

  if (error) throw error
  return data
}

export async function deletePurchaseOrder(id: string) {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  // Only allow deleting draft POs
  const { data: po } = await supabase
    .from('purchase_orders')
    .select('status')
    .eq('id', id)
    .single()

  if (po?.status !== 'draft') {
    throw new Error('Only draft purchase orders can be deleted.')
  }

  const { error } = await supabase
    .from('purchase_orders')
    .delete()
    .eq('id', id)
    .eq('merchant_id', merchantId)

  if (error) throw error
  revalidatePath('/inventory/purchase-orders')
}

export async function updatePurchaseOrderFull(id: string, params: {
  supplier_id: string
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

  // 1. Update PO header
  const subtotal = params.items.reduce((acc, item) => acc + (item.quantity_ordered * item.unit_cost), 0)
  const total = subtotal

  const { error: updateError } = await supabase
    .from('purchase_orders')
    .update({
      supplier_id: params.supplier_id,
      expected_date: params.expected_date,
      notes: params.notes,
      subtotal,
      total,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('merchant_id', merchantId)

  if (updateError) throw updateError

  // 2. Delete old items
  const { error: deleteItemsError } = await supabase
    .from('purchase_order_items')
    .delete()
    .eq('po_id', id)

  if (deleteItemsError) throw deleteItemsError

  // 3. Insert new items
  const itemsToInsert = params.items.map(item => ({
    po_id: id,
    product_id: item.product_id,
    variant_id: item.variant_id || null,
    quantity_ordered: item.quantity_ordered,
    unit_cost: item.unit_cost,
    total: item.quantity_ordered * item.unit_cost
  }))

  const { error: insertItemsError } = await supabase
    .from('purchase_order_items')
    .insert(itemsToInsert)

  if (insertItemsError) throw insertItemsError

  revalidatePath('/inventory/purchase-orders')
  revalidatePath(`/inventory/purchase-orders/${id}`)
}

export async function getGoodsReceipt(id: string) {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  const { data, error } = await supabase
    .from('goods_receipts')
    .select('*, purchase_orders(po_number, total, subtotal, suppliers(name)), goods_receipt_items(*, products(name), purchase_order_items(unit_cost, quantity_ordered, quantity_received))')
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .single()

  if (error) throw error
  return data
}

export async function recordPurchasePayment(params: {
  poId: string
  amount: number
  method: string
  notes?: string
  receiptUrl?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const merchantId = await getMerchantId(supabase)

  // 1. Get PO current state
  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .select('*, suppliers(name)')
    .eq('id', params.poId)
    .single()
  
  if (poError || !po) throw new Error('Purchase order not found')

  const totalPaid = (po.amount_paid || 0) + Number(params.amount)
  let newPaymentStatus = 'unpaid'
  if (totalPaid >= po.total) {
    newPaymentStatus = 'paid'
  } else if (totalPaid > 0) {
    newPaymentStatus = 'partially_paid'
  }

  // 2. Update PO
  const { error: updateError } = await supabase
    .from('purchase_orders')
    .update({
      amount_paid: totalPaid,
      payment_status: newPaymentStatus,
      payment_notes: params.notes,
      updated_at: new Date().toISOString()
    })
    .eq('id', params.poId)

  if (updateError) throw updateError

  // 3. Create Expense Record
  const { error: expenseError } = await supabase
    .from('expenses')
    .insert({
      merchant_id: merchantId,
      purchase_order_id: params.poId,
      vendor_name: po.suppliers?.name || 'Supplier',
      total_amount: params.amount,
      payment_method: params.method,
      notes: `Payment for PO ${po.po_number}. ${params.notes || ''}`,
      receipt_url: params.receiptUrl || '',
      receipt_storage_path: '',
      status: 'confirmed',
      category: 'Purchases',
      receipt_date: new Date().toISOString()
    })

  if (expenseError) throw expenseError

  revalidatePath('/inventory/purchasing')
  revalidatePath(`/inventory/purchase-orders/${params.poId}`)
  return { success: true }
}

export async function getPurchasePayments() {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  const { data, error } = await supabase
    .from('expenses')
    .select('*, purchase_orders(po_number, suppliers(name))')
    .eq('merchant_id', merchantId)
    .not('purchase_order_id', 'is', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}
