import { NextRequest, NextResponse } from 'next/server'
import { createClient }   from '@/lib/supabase/server'
import { epPost }         from '@/lib/easyparcel'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { merchantId } = body

  const { data: cfg } = await supabase
    .from('merchant_easyparcel_config')
    .select('*, merchant:merchants(*)')
    .eq('merchant_id', merchantId).single()
    
  const apiKey  = cfg?.api_key  || process.env.EASYPARCEL_API_KEY
  const authKey = cfg?.auth_key || process.env.EASYPARCEL_AUTH_KEY
  const isDemo  = cfg ? (cfg.environment === 'sandbox') : (process.env.NODE_ENV !== 'production')

  if (!apiKey) return NextResponse.json({ error: 'EasyParcel API Key not configured' }, { status: 400 })

  const m = cfg?.merchant
  const mappedBulk = body.bulk.map((b: any) => ({
    ...b,
    pick_code:  b.pick_code  || cfg?.sender_postcode || m?.postcode,
    pick_state: b.pick_state || cfg?.sender_state    || m?.state,
  }))

  const result = await epPost(isDemo, 'MPRateCheckingBulk', {
    authentication: authKey,
    api:            apiKey,
    bulk:           mappedBulk,
    exclude_fields: ['rates.*.pickup_point'],
  })
  return NextResponse.json(result)
}
