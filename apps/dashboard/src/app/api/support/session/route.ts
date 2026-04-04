import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createSupportSession } from '@project1/support-agent'

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client not initialized' }, { status: 500 })
  }

  try {
    const { merchantId, customerEmail, customerName } = await req.json()

    if (!merchantId) {
      return NextResponse.json({ error: 'merchantId is required' }, { status: 400 })
    }

    // 1. Verify merchant exists
    const { data: merchant, error: mError } = await supabaseAdmin
      .from('merchants')
      .select('id, store_name')
      .eq('owner_id', merchantId) // Note: merchantId in our context often refers to the auth.users(id) of the merchant
      .single()

    // Wait, let's verify if 'merchantId' passed from the widget is the merchants(id) or users(id).
    // The sessions table uses auth.users(id).
    
    if (mError || !merchant) {
      // Fallback: check if merchantId refers to the 'id' column in merchants table
      const { data: m2, error: mError2 } = await supabaseAdmin
        .from('merchants')
        .select('id, owner_id, store_name')
        .eq('id', merchantId)
        .single()
      
      if (mError2 || !m2) {
        return NextResponse.json({ error: 'Merchant not found' }, { status: 404 })
      }
      
      // Use the owner_id (user id) for foreign key consistency in support tables
      const sessionId = await createSupportSession(m2.owner_id, customerEmail, customerName)
      return NextResponse.json({ sessionId, storeName: m2.store_name, merchantId: m2.owner_id })
    }

    const sessionId = await createSupportSession(merchantId, customerEmail, customerName)
    return NextResponse.json({ sessionId, storeName: merchant.store_name, merchantId })

  } catch (error: any) {
    console.error('[API/Support/Session] Error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}
export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client not initialized' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const customerEmail = searchParams.get('customerEmail')
  const merchantId = searchParams.get('merchantId')

  if (!customerEmail) {
    return NextResponse.json({ error: 'customerEmail is required' }, { status: 400 })
  }

  try {
    let query = supabaseAdmin
      .from('support_sessions')
      .select(`
        id,
        status,
        created_at,
        updated_at,
        merchant_id,
        merchants:merchant_id (store_name)
      `)
      .eq('customer_email', customerEmail)
      .order('updated_at', { ascending: false })
      .limit(20)

    if (merchantId) {
      query = query.eq('merchant_id', merchantId)
    }

    const { data: sessions, error } = await query

    if (error) throw error

    return NextResponse.json(sessions || [])
  } catch (error: any) {
    console.error('[API/Support/Session] GET Error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}
