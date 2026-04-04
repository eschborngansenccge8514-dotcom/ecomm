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

    const { data: staged, error } = await supabase
      .from('orders')
      .select('id, order_number, subtotal, total_amount, created_at, paid_at')
      .eq('merchant_id', merchant.id)
      .in('einvoice_status', ['sent_to_consolidated_batch', 'pending_buyer_request'])
      .is('consolidated_einvoice_id', null)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(staged || [])

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
