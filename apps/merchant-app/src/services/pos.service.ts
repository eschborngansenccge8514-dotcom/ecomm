import { supabase } from '@/lib/supabase'
import { PosProduct, PosTransactionPayload } from '@project1/domain'

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export const posService = {
  async getOrInitializeSession() {
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
      .select('id, store_name, store_config')
      .eq('owner_id', user.id)
      .single()
    
    if (!merchant) throw new Error('Merchant not found')
    const merchantId = merchant.id
    const merchantName = merchant.store_name
    const taxRate = Number(merchant.store_config?.taxRate ?? 8)

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

    return { outletId, sessionId, outletName, userName, merchantName, taxRate }
  },

  async fetchPosProducts(merchantId: string) {
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
  },

  async submitTransaction(payload: PosTransactionPayload) {
    // 1. Get user profile and merchant
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('owner_id', user.id)
      .single()
      
    const merchantId = merchant?.id
    if (!merchantId) throw new Error('Merchant not found')

    // 2. Generate Receipt Number
    const timestamp = Date.now().toString().slice(-8)
    const suffix = Math.random().toString(36).substring(2, 5).toUpperCase()
    const receiptNumber = `RCP-${payload.outletId.slice(0, 4)}-${timestamp}-${suffix}`

    // 3. Create Transaction
    const { data: txn, error: txnError } = await supabase
      .from('pos_transactions')
      .insert({
        merchant_id: merchantId,
        outlet_id: payload.outletId,
        session_id: payload.sessionId,
        customer_id: payload.customerId || null,
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

    // 4. Create Items
    const items = payload.items.map(item => ({
      transaction_id: txn.id,
      product_id: item.productId,
      variant_id: item.variantId || null,
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
}
