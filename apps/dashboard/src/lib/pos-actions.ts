'use server'

import { createClient } from '@/lib/supabase/server'
import { PosProduct, PosTransactionPayload } from '@project1/domain'

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export async function getOrInitializeSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // 1. Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const userName = profile?.full_name || user.email?.split('@')[0] || 'Cashier'

  // 2. Get merchant
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, store_name')
    .eq('owner_id', user.id)
    .single()
  
  if (!merchant) throw new Error('Merchant not found')
  const merchantId = merchant.id
  const merchantName = merchant.store_name

  // 3. Get or Create primary outlet
  let outletId: string
  let outletName: string
  const { data: outlet } = await supabase
    .from('pos_outlets')
    .select('id, name')
    .eq('merchant_id', merchantId)
    .limit(1)
    .single()
  
  if (outlet) {
    outletId = outlet.id
    outletName = outlet.name
  } else {
    const { data: newOutlet, error } = await supabase
      .from('pos_outlets')
      .insert({
        merchant_id: merchantId,
        name: 'Main Outlet',
        is_active: true
      })
      .select('id, name')
      .single()
    if (error) throw error
    outletId = newOutlet.id
    outletName = newOutlet.name
  }

  // 4. Get or Create active session
  let sessionId: string
  const { data: session } = await supabase
    .from('pos_sessions')
    .select('id')
    .eq('outlet_id', outletId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  
  if (session) {
    sessionId = session.id
  } else {
    const { data: newSession, error } = await supabase
      .from('pos_sessions')
      .insert({
        merchant_id: merchantId,
        outlet_id: outletId,
        cashier_id: user.id,
        opening_cash_rm: 0,
        status: 'open'
      })
      .select('id')
      .single()
    if (error) throw error
    sessionId = newSession.id
  }

  return { outletId, sessionId, outletName, userName, merchantName }
}

export async function submitTransaction(payload: PosTransactionPayload) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // 1. Get merchant_id
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .single()
    
  const merchantId = merchant?.id
  if (!merchantId) throw new Error('Merchant not found')

  // 2. Self-Healing: Ensure valid IDs
  let outletId = payload.outletId
  let sessionId = payload.sessionId
  
  if (!uuidRegex.test(outletId) || !uuidRegex.test(sessionId)) {
    const session = await getOrInitializeSession()
    outletId = session.outletId
    sessionId = session.sessionId
  }

  // 3. Validate customer_id
  const customerId = (payload.customerId && uuidRegex.test(payload.customerId)) ? payload.customerId : null

  // 4. Generate Receipt Number
  const receiptNumber = `RCP-${outletId.slice(0, 4)}-${Date.now()}`

  // 5. Create Transaction
  const { data: txn, error: txnError } = await supabase
    .from('pos_transactions')
    .insert({
      merchant_id: merchantId,
      outlet_id: outletId,
      session_id: sessionId,
      customer_id: customerId,
      receipt_number: receiptNumber,
      total_rm: payload.totals.total,
      subtotal_rm: payload.totals.subtotal,
      tax_rm: payload.totals.tax,
      discount_rm: payload.totals.lineDiscounts + payload.totals.globalDiscount + payload.totals.pointsDiscount,
      payment_method: payload.paymentMethod,
      payment_status: 'completed',
      cash_received_rm: payload.cashReceived || 0,
      change_rm: payload.change || 0,
      loyalty_points_earned: Math.round(payload.totals.pointsEarned),
      loyalty_points_redeemed: Math.round(payload.totals.pointsDiscount * 100),
      notes: payload.notes,
      einvoice_status: 'sent_to_consolidated_batch'
    })
    .select()
    .single()

  if (txnError) throw txnError

  // 6. Create Items
  const items = payload.items.map(item => ({
    transaction_id: txn.id,
    product_id: item.productId,
    variant_id: uuidRegex.test(item.variantId || '') ? item.variantId : null,
    product_name: item.name,
    sku: item.sku,
    unit_price_rm: item.unitPrice,
    qty: item.qty,
    discount_rm: item.discountRm,
    line_total_rm: item.lineTotal
  }))

  const { error: itemsError } = await supabase
    .from('pos_transaction_items')
    .insert(items)

  if (itemsError) throw itemsError

  return { success: true, txnId: txn.id, receiptNumber }
}

export async function closePosSession(sessionId: string, closingCash: number) {
  const supabase = await createClient()
  if (!uuidRegex.test(sessionId)) throw new Error('Invalid session ID')

  const { error } = await supabase
    .from('pos_sessions')
    .update({ 
      status: 'closed', 
      closed_at: new Date().toISOString(),
      actual_cash_counted_rm: closingCash
    })
    .eq('id', sessionId)

  if (error) throw error
  return { success: true }
}

export async function fetchPosHistory(outletId: string) {
  const supabase = await createClient()
  if (!uuidRegex.test(outletId)) return []

  const { data, error } = await supabase
    .from('pos_transactions')
    .select(`
      id,
      receipt_number,
      total_rm,
      payment_method,
      created_at,
      pos_transaction_items (id),
      pos_einvoice_requests (id, status)
    `)
    .eq('outlet_id', outletId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error
  return data || []
}

export async function fetchPosAlerts() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  
  if (!merchant) return []

  const { data: session } = await supabase
    .from('pos_sessions')
    .select('id, created_at')
    .eq('merchant_id', merchant.id)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  
  const alerts: any[] = []

  if (session) {
    const sessionAgeHours = (Date.now() - new Date(session.created_at).getTime()) / (1000 * 60 * 60)
    if (sessionAgeHours > 12) {
      alerts.push({
        id: 'session-overdue',
        type: 'system',
        name: 'Session Overdue',
        message: 'Current shift has exceeded 12 hours. Please consider closing for reconciliation.',
        severity: 'warning'
      })
    }
  }

  const { data: products, error: prodError } = await supabase
    .from('products')
    .select('id, name, stock_quantity, restock_threshold')
    .eq('merchant_id', merchant.id)
    .lte('stock_quantity', 5)
    .limit(10)

  if (prodError) throw prodError
  
  if (products) {
    products.forEach((p: any) => {
      alerts.push({
        ...p,
        type: 'inventory'
      })
    })
  }

  return alerts
}

export async function fetchPosProducts(outletId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  
  let merchantId = merchant?.id

  if (!merchantId) {
    const { data: all } = await supabase.from('merchants').select('id').limit(1)
    merchantId = all?.[0]?.id
  }

  if (!merchantId) return []
  
  const { data, error } = await supabase
    .from('products')
    .select(`
      id,
      name,
      sku,
      barcode:gtin,
      unitPrice:price,
      images,
      stock_quantity,
      category:categories(name),
      product_variants (
        id,
        name,
        sku,
        price_modifier,
        barcode:sku,
        stock_quantity
      )
    `)
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    
  if (error) throw error
  
  const products: PosProduct[] = []
  data.forEach((p: any) => {
    const basePrice = Number(p.unitPrice) || 0
    const imageUrl = p.images?.[0] || null
    const categoryName = p.category?.name || 'Uncategorized'

    if (p.product_variants && p.product_variants.length > 0) {
      p.product_variants.forEach((v: any) => {
        products.push({
          id: p.id,
          variantId: v.id,
          name: `${p.name} (${v.name})`,
          sku: v.sku || p.sku || '',
          barcode: v.barcode || p.barcode || '',
          unitPrice: basePrice + (Number(v.price_modifier) || 0),
          imageUrl,
          category: categoryName,
          stockQty: v.stock_quantity || 0
        })
      })
    } else {
      products.push({
        id: p.id,
        name: p.name,
        sku: p.sku || '',
        barcode: p.barcode || '',
        unitPrice: basePrice,
        imageUrl,
        category: categoryName,
        stockQty: p.stock_quantity || 0
      })
    }
  })
  
  return products
}
