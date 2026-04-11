'use server'

import { createClient } from '@/lib/supabase/server'
import { PosProduct, PosTransactionPayload } from '@project1/domain'

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export async function getOrInitializeSession(autoCreate = true) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  try {
    // 1. Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    const userName = profile?.full_name || user.email?.split('@')[0] || 'Cashier'

    // 2. Get merchant
    const { data: merchant, error: mErr } = await supabase
      .from('merchants')
      .select('id, store_name, store_config')
      .eq('owner_id', user.id)
      .maybeSingle()
    
    if (mErr) throw mErr
    if (!merchant) throw new Error('Merchant not found')
    
    const merchantId = merchant.id
    const merchantName = merchant.store_name
    const taxRate = Number(merchant.store_config?.taxRate ?? 8)

    // 3. Get or Create primary outlet
    let outletId: string
    let outletName: string
    const { data: outlet, error: oErr } = await supabase
      .from('pos_outlets')
      .select('id, name')
      .eq('merchant_id', merchantId)
      .limit(1)
      .maybeSingle()
    
    if (oErr) throw oErr
    
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
      if (error) {
        console.error('Outlet Creation Error:', error)
        throw error
      }
      outletId = newOutlet.id
      outletName = newOutlet.name
    }

    // 4. Get active session
    const { data: session, error: sErr } = await supabase
      .from('pos_sessions')
      .select('id, opening_cash_rm')
      .eq('outlet_id', outletId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (sErr) throw sErr
    
    if (session) {
      return { 
        outletId, 
        sessionId: session.id, 
        outletName, 
        userName, 
        merchantName, 
        taxRate, 
        sessionRequired: false,
        openingCash: Number(session.opening_cash_rm) || 0
      }
    }

    // No active session found
    if (autoCreate) {
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
      if (error) {
        console.error('Session Creation Error:', error)
        throw error
      }
      return { 
        outletId, 
        sessionId: newSession.id, 
        outletName, 
        userName, 
        merchantName, 
        taxRate, 
        sessionRequired: false,
        openingCash: 0 
      }
    }

    return { 
      outletId, 
      sessionId: undefined, 
      outletName, 
      userName, 
      merchantName, 
      taxRate, 
      sessionRequired: true 
    }
  } catch (err) {
    console.error('POS Init Action Error:', err)
    throw err
  }
}

export async function openPosSession(outletId: string, openingCash: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  try {
    const { data: merchant, error: mErr } = await supabase
      .from('merchants')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()
    
    if (mErr) throw mErr
    if (!merchant) throw new Error('Merchant not found')

    const { data: newSession, error } = await supabase
      .from('pos_sessions')
      .insert({
        merchant_id: merchant.id,
        outlet_id: outletId,
        cashier_id: user.id,
        opening_cash_rm: openingCash,
        status: 'open'
      })
      .select('id')
      .single()

    if (error) {
      console.error('Open Session Insert Error:', error)
      throw error
    }
    return { success: true, sessionId: newSession.id }
  } catch (err) {
    console.error('Open Session Action Error:', err)
    throw err
  }
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

  /* --- DISABLING REAL-TIME POSTING FOR PHASE 2 (BATCHING) ---
  try {
    const { postPOSSale } = await import('@project1/accounting')
    
    // Calculate total COGS if possible
    let totalCogs = 0
    const productIds = Array.from(new Set(payload.items.map(i => i.productId)))
    
    const { data: products } = await supabase
      .from('products')
      .select('id, cost_price')
      .in('id', productIds)

    if (products) {
      const costMap = new Map(products.map(p => [p.id, Number(p.cost_price) || 0]))
      totalCogs = payload.items.reduce((sum, item) => {
        return sum + (costMap.get(item.productId) || 0) * item.qty
      }, 0)
    }

    await postPOSSale({
      merchantId: merchantId,
      totalAmount: payload.totals.total,
      subtotal: payload.totals.subtotal,
      sstAmount: payload.totals.tax,
      cogsAmount: totalCogs,
      createdAt: new Date(),
      txnRef: receiptNumber,
      paymentMethod: payload.paymentMethod as any,
    })
  } catch (accError) {
    console.error('Accounting Sync Failed (Non-Fatal):', accError)
  }
  */
  // -----------------------------------------------------------

  // Hydrate full transaction for instant UI render
  let fullTxn = null
  try {
    const { data } = await supabase
      .from('pos_transactions')
      .select(`
        *,
        pos_transaction_items (*),
        merchants (*),
        pos_sessions (
          profiles (full_name)
        )
      `)
      .eq('id', txn.id)
      .single()
    fullTxn = data
  } catch (err) {
    console.error('Hydration Fetch Error (Non-Fatal):', err)
  }

  return { success: true, txnId: txn.id, receiptNumber, fullTxn }
}

export async function closePosSession(sessionId: string, closingCash: number, notes?: string) {
  const supabase = await createClient()
  if (!uuidRegex.test(sessionId)) throw new Error('Invalid session ID')

  const summary = await getSessionSummary(sessionId)
  
  const discrepancy = closingCash - summary.expectedCash
  
  const { data: sessionData, error: fetchErr } = await supabase
    .from('pos_sessions')
    .select('merchant_id')
    .eq('id', sessionId)
    .single()
  
  if (fetchErr) throw fetchErr

  // Post to Accounting Batch
  try {
     const { postPOSSessionBatch } = await import('@project1/accounting')
     await postPOSSessionBatch({
        merchantId: sessionData.merchant_id, // Fixed casing
        sessionId: sessionId,
        sessionNo: sessionId.slice(0, 8).toUpperCase(),
        totalSubtotal: summary.totalSubtotal,
        totalTax: summary.totalTax,
        totalTotal: summary.totalSales,
        totalCogs: summary.totalCogs,
        cashTotal: summary.cashSales,
        cardTotal: summary.cardSales,
        ewalletTotal: summary.ewalletSales,
        date: new Date()
     })
  } catch (accErr) {
     console.error('Session Batch Posting Failed:', accErr)
     // In Phase 2, we might want to block or log this
  }

  try {
    const { error } = await supabase
      .from('pos_sessions')
      .update({ 
        status: 'closed', 
        closed_at: new Date().toISOString(),
        actual_cash_counted_rm: closingCash || 0,
        expected_cash_rm: summary.expectedCash || 0,
        total_sales_rm: summary.totalSales || 0,
        discrepancy_rm: discrepancy || 0,
        reconciliation_notes: notes || '',
        posted_to_journal: true
      })
      .eq('id', sessionId)
      
    if (error) {
      console.error('POS Session Update Failed:', error)
      throw new Error(`Database Error [${error.code}]: ${error.message || 'Unknown error'}`)
    }
  } catch (err) {
    console.error('Close POS Session Error:', err)
    throw err
  }

  return { success: true }
}


export async function getSessionSummary(sessionId: string) {
  const supabase = await createClient()
  if (!uuidRegex.test(sessionId)) throw new Error('Invalid session ID')

  try {
    // 1. Get session info
    const { data: session, error: sessionError } = await supabase
      .from('pos_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle()
    
    if (sessionError) throw sessionError
    if (!session) throw new Error('Session not found')

    // 2. Get all transactions for this session
    const { data: transactions, error: txnError } = await supabase
      .from('pos_transactions')
      .select('total_rm, subtotal_rm, tax_rm, payment_method, pos_transaction_items(product_id, qty)')
      .eq('session_id', sessionId)
    
    if (txnError) throw txnError

    // 3. Get products to calculate COGS
    const allProdIds = Array.from(new Set(
      transactions?.flatMap(t => t.pos_transaction_items.map((i: any) => i.product_id)) || []
    ))
    
    const { data: products } = await supabase
      .from('products')
      .select('id, cost_price, categories(name)')
      .in('id', allProdIds)
    
    const costMap = new Map(products?.map(p => [p.id, Number(p.cost_price) || 0]) || [])
    const catMap = new Map(products?.map(p => [p.id, (Array.isArray(p.categories) ? p.categories[0]?.name : (p.categories as any)?.name) || 'Uncategorized']) || [])

    const summary = {
      openingCash: Number(session.opening_cash_rm) || 0,
      cashSales: 0,
      cardSales: 0,
      ewalletSales: 0,
      totalSales: 0,
      totalSubtotal: 0,
      totalTax: 0,
      totalCogs: 0,
      transactionCount: transactions?.length || 0,
      expectedCash: 0,
      salesByCategory: {} as Record<string, number>
    }

    transactions?.forEach(txn => {
      const amount = Number(txn.total_rm) || 0
      const subtotal = Number(txn.subtotal_rm) || 0
      const tax = Number(txn.tax_rm) || 0
      
      summary.totalSales += amount
      summary.totalSubtotal += subtotal
      summary.totalTax += tax
      
      if (txn.payment_method === 'cash') summary.cashSales += amount
      else if (txn.payment_method === 'card') summary.cardSales += amount
      else if (txn.payment_method === 'ewallet') summary.ewalletSales += amount

      // Deep stats per item
      txn.pos_transaction_items?.forEach((item: any) => {
        const cost = costMap.get(item.product_id) || 0
        const cat = catMap.get(item.product_id) || 'Uncategorized'
        
        summary.totalCogs += (cost * item.qty)
        summary.salesByCategory[cat] = (summary.salesByCategory[cat] || 0) + (amount * (subtotal / amount || 1)) // approximate
      })
    })

    summary.expectedCash = summary.openingCash + summary.cashSales

    return summary
  } catch (err) {
    console.error('Get Session Summary Error:', err)
    throw err
  }
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
      barcode,
      unitPrice:price,
      images,
      stock_quantity,
      category:categories(name),
      product_variants (
        id,
        name,
        sku,
        price_modifier,
        barcode,
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

export async function verifyPosPin(pin: string): Promise<{ success: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('pos_pin')
    .eq('id', user.id)
    .single()

  if (error || !profile) {
    throw new Error('Could not retrieve security profile')
  }

  if (!profile.pos_pin) {
    return { success: false, message: 'NO_PIN_SET' }
  }

  if (profile.pos_pin === pin) {
    return { success: true }
  }

  return { success: false, message: 'INVALID_PIN' }
}

export async function updatePosPin(pin: string): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Validation: 4-digit PIN
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('PIN must be exactly 4 digits.')
  }

  const { error } = await supabase
    .from('profiles')
    .update({ pos_pin: pin })
    .eq('id', user.id)

  if (error) throw error

  return { success: true }
}

export async function updateUserProfile(data: { full_name?: string; avatar_url?: string }): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', user.id)

  if (error) throw error
  return { success: true }
}

export async function updateMerchantSettings(data: { 
  store_name?: string; 
  tagline?: string;
  phone?: string;
  whatsapp?: string;
  tax_rate?: number;
  address?: string;
}): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Get merchant
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, store_config')
    .eq('owner_id', user.id)
    .single()

  if (!merchant) throw new Error('Merchant not found')

  const updates: any = {}
  if (data.store_name) updates.store_name = data.store_name
  
  // Update store_config for tax and other flexible fields
  const newConfig = { ...merchant.store_config }
  if (data.tagline) newConfig.tagline = data.tagline
  if (data.phone) newConfig.phone = data.phone
  if (data.whatsapp) newConfig.whatsapp = data.whatsapp
  if (data.tax_rate !== undefined) newConfig.taxRate = data.tax_rate
  if (data.address) newConfig.address = data.address
  
  updates.store_config = newConfig

  const { error } = await supabase
    .from('merchants')
    .update(updates)
    .eq('id', merchant.id)

  if (error) throw error
  return { success: true }
}

