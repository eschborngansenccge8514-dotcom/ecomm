import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { epPost }       from '@/lib/easyparcel'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { merchantId } = await req.json()
  const { data: cfg }  = await supabase
    .from('merchant_easyparcel_settings')
    .select('api_key, is_demo')
    .eq('merchant_id', merchantId).single()
    
  const apiKey  = cfg?.api_key || process.env.EASYPARCEL_API_KEY
  const isDemo  = cfg ? cfg.is_demo : (process.env.NODE_ENV !== 'production')

  if (!apiKey) return NextResponse.json({ error: 'EasyParcel API Key not configured' }, { status: 400 })

  // EPCheckCreditBalance does NOT need authentication key
  const result = await epPost(isDemo, 'EPCheckCreditBalance', { api: apiKey })
  return NextResponse.json(result)
}
