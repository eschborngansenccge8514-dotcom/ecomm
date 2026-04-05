import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 })
    }

    // 1. Fetch staged Orders
    const { data: stagedOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, subtotal, total_amount, created_at, paid_at, einvoice_status')
      .eq('merchant_id', merchant.id)
      .in('einvoice_status', ['sent_to_consolidated_batch', 'pending_buyer_request'])
      .is('consolidated_einvoice_id', null)
      .order('created_at', { ascending: false })

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 400 })
    }

    // 2. Fetch staged POS Transactions
    const { data: stagedPos, error: posError } = await supabase
      .from('pos_transactions')
      .select('id, receipt_number, subtotal_rm, total_rm, created_at, einvoice_status')
      .eq('merchant_id', merchant.id)
      .eq('einvoice_status', 'sent_to_consolidated_batch')
      .is('consolidated_einvoice_id', null)
      .order('created_at', { ascending: false })

    if (posError) {
      return NextResponse.json({ error: posError.message }, { status: 400 })
    }

    // 3. Fetch any non-failed e-invoices to ensure we haven't already processed these
    // This is a safety check for items that might be in 'submitted' (Pending LHDN) status
    const { data: activeInvoices } = await supabase
      .from('einvoices')
      .select('order_id, pos_request_id')
      .eq('merchant_id', merchant.id)
      .not('status', 'in', '("error","rejected","cancelled")')

    const processedOrderIds = new Set((activeInvoices || []).map(i => i.order_id).filter(Boolean))
    const processedPosRequestIds = new Set((activeInvoices || []).map(i => i.pos_request_id).filter(Boolean))

    // 4. Combine and unify the response, filtering out already processed items
    const combined = [
      ...(stagedOrders || [])
        .filter(o => !processedOrderIds.has(o.id))
        .map(o => ({
          ...o,
          source: 'orders'
        })),
      ...(stagedPos || [])
        .map(p => ({
          id: p.id,
          order_number: p.receipt_number,
          subtotal: p.subtotal_rm,
          total_amount: p.total_rm,
          created_at: p.created_at,
          paid_at: p.created_at, // POS is always paid on creation
          einvoice_status: p.einvoice_status,
          source: 'pos_transactions'
        }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json(combined)

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
