import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const merchantId = req.nextUrl.searchParams.get('merchantId')
  if (!merchantId) return NextResponse.json({ error: 'Missing merchantId' }, { status: 400 })
  
  const { data: cfg } = await supabase
    .from('merchant_easyparcel_settings')
    .select('*, merchant:merchants(*)')
    .eq('merchant_id', merchantId).single()
    
  if (cfg) return NextResponse.json(cfg)

  // Fallback to merchant profile if no settings found
  const { data: m } = await supabase.from('merchants').select('*').eq('id', merchantId).single()
  return NextResponse.json({
    sender_name:     m?.store_name,
    sender_phone:    m?.phone?.replace(/\D/g, ''),
    sender_addr1:    m?.address_line1,
    sender_city:     m?.city,
    sender_state:    m?.state,
    sender_postcode: m?.postcode,
    is_demo:         process.env.NODE_ENV !== 'production'
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { merchantId, ...settings } = body
  
  const { error } = await supabase.from('merchant_easyparcel_settings').upsert(
    { ...settings, merchant_id: merchantId, updated_at: new Date().toISOString() },
    { onConflict: 'merchant_id' }
  )
  
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
