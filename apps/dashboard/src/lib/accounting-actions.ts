'use server'

import { createClient } from '@/lib/supabase/server'

export async function getSST02Report(monthFrom: number, yearFrom: number, monthTo: number, yearTo: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .single()
  
  if (!merchant) throw new Error("Merchant not found")

  // 1. Fetch Sales and calculate SST by type
  const { data: transactions } = await supabase
    .from('pos_transactions')
    .select('subtotal_rm, tax_rm, pos_transaction_items(tax_rate, lhdn_tax_type, line_total_rm)')
    .eq('merchant_id', merchant.id)
    .gte('created_at', `${yearFrom}-${monthFrom.toString().padStart(2, '0')}-01`)
    .lte('created_at', `${yearTo}-${monthTo.toString().padStart(2, '0')}-31`)

  const salesReport: any = {
    totalSales: 0,
    taxable_6: 0,
    tax_6: 0,
    taxable_8: 0,
    tax_8: 0,
    exempt: 0
  }

  transactions?.forEach(txn => {
    salesReport.totalSales += Number(txn.subtotal_rm)
    
    txn.pos_transaction_items?.forEach((item: any) => {
      const rate = Number(item.tax_rate)
      const amount = Number(item.line_total_rm)
      
      if (rate === 6) {
        salesReport.taxable_6 += amount
        salesReport.tax_6 += (amount * 0.06)
      } else if (rate === 8) {
        salesReport.taxable_8 += amount
        salesReport.tax_8 += (amount * 0.08)
      } else {
        salesReport.exempt += amount
      }
    })
  })

  // 2. Fetch Purchases (SST paid to suppliers)
  const { data: purchases } = await supabase
    .from('purchase_order_items')
    .select('total, unit_cost, quantity_ordered, purchase_orders(order_date, total)')
    .eq('purchase_orders.merchant_id', merchant.id)
    .gte('purchase_orders.order_date', `${yearFrom}-${monthFrom.toString().padStart(2, '0')}-01`)
    .lte('purchase_orders.order_date', `${yearTo}-${monthTo.toString().padStart(2, '0')}-31`)

  const purchaseTotal = purchases?.reduce((sum, p) => sum + Number(p.total), 0) || 0

  return {
    period: `${monthFrom}/${yearFrom} - ${monthTo}/${yearTo}`,
    sales: salesReport,
    purchases: purchaseTotal,
    netPayable: salesReport.tax_6 + salesReport.tax_8
  }
}
