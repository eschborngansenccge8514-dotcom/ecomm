import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { epPost }       from '@/lib/easyparcel'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { merchantId, orderNumbers, shipmentIds } = await req.json()
  const { data: cfg } = await supabase
    .from('merchant_easyparcel_settings')
    .select('api_key, auth_key, is_demo')
    .eq('merchant_id', merchantId).single()
    
  const apiKey  = cfg?.api_key  || process.env.EASYPARCEL_API_KEY
  const authKey = cfg?.auth_key || process.env.EASYPARCEL_AUTH_KEY
  const isDemo  = cfg ? cfg.is_demo : (process.env.NODE_ENV !== 'production')

  if (!apiKey) return NextResponse.json({ error: 'EasyParcel API Key not configured' }, { status: 400 })

  const bulk   = orderNumbers.map((order_no: string) => ({ order_no }))
  const result = await epPost(isDemo, 'MPParcelStatusBulk', {
    authentication: authKey,
    api:            apiKey,
    bulk,
  })

  // Update statuses in DB
  if (result.api_status === 'Success' && result.result) {
    for (let i = 0; i < result.result.length; i++) {
      const r = result.result[i]
      const parcel = r.parcel?.[0]
      if (shipmentIds?.[i] && parcel) {
        await supabase.from('easyparcel_shipments').update({
          order_status: r.status,
          ship_status:  parcel.ship_status ?? undefined,
          awb:          parcel.awb || undefined,
          awb_id_link:  parcel.awb_id_link || undefined,
          updated_at:   new Date().toISOString(),
        }).eq('id', shipmentIds[i])
      }
    }
  }

  return NextResponse.json(result)
}
