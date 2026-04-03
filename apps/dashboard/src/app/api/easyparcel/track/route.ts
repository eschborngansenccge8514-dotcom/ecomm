import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { epPost }       from '@/lib/easyparcel'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { merchantId, awbNumbers, shipmentId } = await req.json()

  const { data: cfg } = await supabase
    .from('merchant_easyparcel_config')
    .select('*')
    .eq('merchant_id', merchantId).single()
    
  const apiKey  = cfg?.api_key  || process.env.EASYPARCEL_API_KEY
  const authKey = cfg?.auth_key || process.env.EASYPARCEL_AUTH_KEY
  const isDemo  = cfg ? (cfg.environment === 'sandbox') : (process.env.NODE_ENV !== 'production')

  if (!apiKey) return NextResponse.json({ error: 'EasyParcel API Key not configured' }, { status: 400 })

  const bulk  = awbNumbers.map((awb: string) => ({ awb_no: awb }))
  const result = await epPost(isDemo, 'MPTrackingBulk', {
    authentication: authKey,
    api:            apiKey,
    bulk,
  })

  // Cache tracking data
  if (result.api_status === 'Success' && shipmentId && result.result?.[0]) {
    await supabase.from('easyparcel_shipments').update({
      tracking_data:       result.result[0],
      ship_status:         result.result[0].latest_status ?? undefined,
      tracking_updated_at: new Date().toISOString(),
    }).eq('id', shipmentId)
  }

  return NextResponse.json(result)
}
