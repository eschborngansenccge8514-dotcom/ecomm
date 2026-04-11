'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { extractQuotationData } from "@project1/agent"

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
    .select('*, supplier:suppliers(name), purchase_order_items(id, quantity_ordered, quantity_received)')
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
    .select('*, supplier:suppliers(*), purchase_order_items(*, products(name, sku, cost_price), product_variants(name, sku, cost_price)), goods_receipts(*), expenses(*)')
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
  
  if (method === 'email' && !po.supplier?.email) {
    throw new Error(`Supplier "${po.supplier?.name}" does not have an email address configured.`)
  }
  
  if (method === 'whatsapp' && !po.supplier?.phone) {
    throw new Error(`Supplier "${po.supplier?.name}" does not have a phone number configured.`)
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
      const phone = po.supplier.phone.replace(/\D/g, '')

      const textMessage = `*Purchase Order ${po.po_number || ''}*\n\nHello ${po.supplier.name},\n\nWe have issued a new purchase order for RM ${po.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}.\n\nPlease find the attached Purchase Order document.\n\nPlease acknowledge receipt.\n\nThank you.`

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

  // 1. Create Goods Receipt header
  const { data: receipt, error: receiptError } = await supabase
    .from('goods_receipts')
    .insert({ po_id: poId, merchant_id: merchantId, received_by: user.id, notes })
    .select()
    .single()
  if (receiptError) throw receiptError

  // 2. Fetch PO items to get product_id / variant_id for each po_item_id
  const poItemIds = items.map(i => i.po_item_id)
  const { data: poItems, error: poItemsError } = await supabase
    .from('purchase_order_items')
    .select('id, product_id, variant_id, quantity_received')
    .in('id', poItemIds)
  if (poItemsError) throw poItemsError

  const poItemMap = Object.fromEntries((poItems ?? []).map((r: any) => [r.id, r]))

  for (const item of items) {
    const poItem = poItemMap[item.po_item_id]
    if (!poItem) continue

    // 3a. Increment quantity_received on PO item
    const { error: qtyError } = await supabase
      .from('purchase_order_items')
      .update({ quantity_received: (poItem.quantity_received ?? 0) + item.quantity })
      .eq('id', item.po_item_id)
    if (qtyError) throw qtyError

    // 3b. Create goods receipt item record
    const { error: griError } = await supabase.from('goods_receipt_items').insert({
      receipt_id: receipt.id,
      po_item_id: item.po_item_id,
      product_id: poItem.product_id,
      variant_id: poItem.variant_id ?? null,
      quantity_received: item.quantity
    })
    if (griError) throw griError

    // 3c. Record inventory movement (trigger will handle stock increment)
    const { error: movementError } = await supabase.from('inventory_movements').insert({
      merchant_id: merchantId,
      product_id: poItem.product_id,
      variant_id: poItem.variant_id ?? null,
      quantity_delta: item.quantity,
      type: 'po_receive',
      reference_id: receipt.id,
      reference_type: 'goods_receipt',
      metadata: { po_id: poId }
    })
    if (movementError) throw movementError
  }

  // 4. Update PO status based on whether all items are fully received
  const { data: allItems } = await supabase
    .from('purchase_order_items')
    .select('quantity_ordered, quantity_received')
    .eq('po_id', poId)

  const allReceived = allItems?.every((i: any) => i.quantity_received >= i.quantity_ordered)
  await supabase
    .from('purchase_orders')
    .update({ status: allReceived ? 'received' : 'partially_received', updated_at: new Date().toISOString() })
    .eq('id', poId)

  // --- ACCOUNTING INTEGRATION: GOODS RECEIPT ---
  try {
    const { postProcurementReceipt } = await import('@project1/accounting')
    const po = await getPurchaseOrder(poId)
    const receiptTotal = items.reduce((sum, item) => {
      const poItem = poItemMap[item.po_item_id]
      return sum + (Number(poItem?.unit_cost || 0) * item.quantity)
    }, 0)

    if (receiptTotal > 0) {
      await postProcurementReceipt({
        merchantId,
        poId,
        poNumber: po.po_number,
        supplier: po.supplier?.name || 'Supplier',
        total: receiptTotal,
        date: new Date()
      })
    }
  } catch (accError) {
    console.error('Procurement Accounting Sync Failed (Receipt):', accError)
  }
  // ---------------------------------------------

  revalidatePath('/inventory/purchase-orders')
  revalidatePath('/products')
  return receipt
}

export async function createDraftPOFromSuggestions(suggestions: any[]) {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  // Group by supplier
  const supplierGroups = suggestions.reduce((acc: any, sug: any) => {
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
    .select('*, purchase_orders(po_number, supplier:suppliers(name))')
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
    .select('*, purchase_orders(po_number, total, subtotal, supplier:suppliers(name)), goods_receipt_items(*, products(name), purchase_order_items(unit_cost, quantity_ordered, quantity_received))')
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
    .select('*, supplier:suppliers(name)')
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
      vendor_name: (Array.isArray(po.supplier) ? po.supplier[0]?.name : po.supplier?.name) || 'Supplier',
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

  // --- ACCOUNTING INTEGRATION: PAYMENT ---
  try {
    const { postProcurementPayment } = await import('@project1/accounting')
    await postProcurementPayment({
      merchantId,
      poId: params.poId,
      poNumber: po.po_number,
      amount: Number(params.amount),
      date: new Date(),
      paymentMethod: params.method
    })
  } catch (accError) {
    console.error('Procurement Accounting Sync Failed (Payment):', accError)
  }
  // ---------------------------------------

  revalidatePath('/inventory/purchasing')
  revalidatePath(`/inventory/purchase-orders/${params.poId}`)
  return { success: true }
}

export async function getPurchasePayments() {
  const supabase = await createClient()
  const merchantId = await getMerchantId(supabase)

  const { data, error } = await supabase
    .from('expenses')
    .select('*, purchase_orders(po_number, supplier:suppliers(name))')
    .eq('merchant_id', merchantId)
    .not('purchase_order_id', 'is', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function analyseQuotation(storagePath: string, mimeType: any) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data: merchant } = await supabase
    .from('merchants')
    .select('*')
    .eq('owner_id', user.id)
    .single()
    
  if (!merchant) throw new Error("Merchant not found")

  // 1. Download file from Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("receipts")
    .download(storagePath);

  if (downloadError || !fileData) {
    console.error("Download error:", downloadError);
    throw new Error("Failed to download quotation from storage");
  }

  // 2. Extract data via AI
  const buffer = await fileData.arrayBuffer();
  
  const businessContext = `
    Store Name: ${merchant.store_name}
    Store Type: ${merchant.store_type || 'General Merchant'}
    Description: ${merchant.description || 'N/A'}
  `.trim();

  const extraction = await extractQuotationData(buffer, mimeType as any, businessContext);

  // 3. Try mapping items to products or create them
  const mappedItems = []
  const createdProductsMap = new Map<string, string>() // description -> id

  for (const item of extraction.items) {
    // Improved search: break into keywords and find products that match most keywords
    const keywords = item.description.split(/\s+/).filter(k => k.length > 2)
    const orQuery = keywords.map(k => `name.ilike.%${k}%,sku.ilike.%${k}%`).join(',')
    
    const { data: products } = await supabase
      .from('products')
      .select('id, name, sku, cost_price, product_variants(id, name, sku)')
      .eq('merchant_id', merchant.id)
      .or(orQuery || `name.ilike.%${item.description}%`)
      .limit(1)

    if (products && products.length > 0) {
      const p = products[0]
      mappedItems.push({
        product_id: p.id,
        variant_id: p.product_variants?.[0]?.id || null,
        name: p.name + (p.product_variants?.[0] ? ` — ${p.product_variants[0].name}` : ''),
        sku: p.product_variants?.[0]?.sku || p.sku || '',
        quantity_ordered: item.quantity,
        unit_cost: item.unitPrice
      })
    } else {
      // Not found — check if we already created it in this loop
      let productId = createdProductsMap.get(item.description)
      
      if (!productId) {
        // Create new product
        const { data: newProduct, error: createError } = await supabase
          .from('products')
          .insert({
            merchant_id: merchant.id,
            name: item.description,
            sku: `AUTO-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
            cost_price: item.unitPrice || 0,
            price: (item.unitPrice || 0) * 1.5, // Default 50% markup
            status: 'active',
            track_inventory: true,
            stock_quantity: 0
          })
          .select('id')
          .single()

        if (!createError && newProduct) {
          productId = newProduct.id
          if (productId) {
            createdProductsMap.set(item.description, productId)
          }
        }
      }

      mappedItems.push({
        product_id: productId || '',
        variant_id: null,
        name: productId ? item.description : `[FAILED] ${item.description}`,
        sku: '',
        quantity_ordered: item.quantity,
        unit_cost: item.unitPrice,
        unmapped: !productId
      })
    }
  }

  // 4. Try mapping supplier or create it
  let supplierId = ''
  let supplierObj = null

  if (extraction.vendorName) {
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('*')
      .eq('merchant_id', merchant.id)
      .ilike('name', extraction.vendorName.trim()) 
      .limit(1)
    
    if (suppliers && suppliers.length > 0) {
      supplierId = suppliers[0].id
      supplierObj = suppliers[0]
    } else {
      // Create new supplier
      const { data: newSupplier, error: supplierError } = await supabase
        .from('suppliers')
        .insert({
          merchant_id: merchant.id,
          name: extraction.vendorName.trim(),
          code: `VND-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
          email: extraction.vendorEmail || null,
          phone: extraction.vendorPhone || null,
          address: extraction.vendorAddress || null,
          is_active: true
        })
        .select('*')
        .single()
      
      if (supplierError) {
        console.error('Error auto-creating supplier:', supplierError)
      }
      
      if (!supplierError && newSupplier) {
        supplierId = newSupplier.id
        supplierObj = newSupplier
      }
    }
  }

  return {
    extraction: {
      ...extraction,
      supplierId,
      supplier: supplierObj,
      items: mappedItems
    }
  }
}
