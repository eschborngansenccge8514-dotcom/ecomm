import { NextRequest, NextResponse } from 'next/server'
import { createClient }   from '@/lib/supabase/server'
import { epPost }         from '@/lib/easyparcel'
import { format }         from 'date-fns'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await req.json()
  const { merchantId, orderId, parcel, couriers, dropoff } = body
  // parcel: { weight, width, length, height, content, value, collect_date,
  //           pick_*, send_*, reference }

  const { data: cfg } = await supabase
    .from('merchant_easyparcel_config')
    .select('*').eq('merchant_id', merchantId).single()
    
  const apiKey  = cfg?.api_key  || process.env.EASYPARCEL_API_KEY
  const authKey = cfg?.auth_key || process.env.EASYPARCEL_AUTH_KEY
  const isDemo  = cfg ? (cfg.environment === 'sandbox') : (process.env.NODE_ENV !== 'production')

  if (!apiKey) return NextResponse.json({ error: 'EasyParcel API Key not configured' }, { status: 400 })

  const collectDate = parcel.collect_date || format(new Date(), 'yyyy-MM-dd')

  // EPSubmitOrderBulkV3 — direct order + payment in one call
  const result = await epPost(isDemo, 'EPSubmitOrderBulkV3', {
    authentication: authKey,
    api:            apiKey,
    courier:        couriers ?? ['Poslaju', 'Skynet', 'Nationwide', 'J&T Express', 'DHL eCommerce'],
    dropoff:        dropoff ? 1 : 0,
    bulk: [{
      referrence:    parcel.reference ?? `ORD-${orderId?.slice(0,8) ?? Date.now()}`,
      weight:        parcel.weight,
      width:         parcel.width  || 0,
      length:        parcel.length || 0,
      height:        parcel.height || 0,
      content:       parcel.content,
      value:         parcel.value,
      pick_name:     parcel.pick_name,
      pick_company:  parcel.pick_company ?? '',
      pick_contact:  parcel.pick_contact,
      pick_mobile:   parcel.pick_mobile  ?? '',
      pick_addr1:    parcel.pick_addr1,
      pick_addr2:    parcel.pick_addr2   ?? '',
      pick_city:     parcel.pick_city,
      pick_state:    parcel.pick_state,
      pick_code:     parcel.pick_postcode,
      pick_country:  'MY',
      send_name:     parcel.send_name,
      send_contact:  parcel.send_contact,
      send_mobile:   parcel.send_mobile  ?? '',
      send_addr1:    parcel.send_addr1,
      send_addr2:    parcel.send_addr2   ?? '',
      send_city:     parcel.send_city,
      send_state:    parcel.send_state,
      send_code:     parcel.send_postcode,
      send_country:  'MY',
      collect_date:  collectDate,
      send_email:    parcel.send_email   ?? '',
      sms:           1,
    }],
  })

  if (result.api_status !== 'Success') {
    return NextResponse.json({ error: result.error_remark || 'API Error' }, { status: 400 })
  }

  // Fixing the [^0] markers from the guide to [0]
  const success = result.result?.success?.[0]
  if (!success) {
    const fail = result.result?.fail?.[0]
    return NextResponse.json({ error: fail?.remarks ?? 'Booking failed' }, { status: 400 })
  }

  // Save to easyparcel_shipments
  const { data: saved, error: dbErr } = await supabase.from('easyparcel_shipments').insert({
    merchant_id:      merchantId,
    order_id:         orderId ?? null,
    ep_order_number:  success.order_number,
    ep_parcel_number: success.parcel_number,
    awb:              success.awb,
    awb_id_link:      success.awb_id_link,
    tracking_url:     success.tracking_url,
    courier_name:     success.courier,
    courier_short:    success.courier_short,
    shipping_cost:    Number(success.price)      || 0,
    tax_amount:       Number(success.tax)        || 0,
    addon_price:      Number(success.addon_price)|| 0,
    order_status:     'Paid',
    ship_status:      'Pending For Collection',
    weight:           parcel.weight,
    width:            parcel.width   || 0,
    length:           parcel.length  || 0,
    height:           parcel.height  || 0,
    content:          parcel.content,
    declared_value:   parcel.value,
    reference:        parcel.reference ?? '',
    collect_date:     collectDate,
    pick_name:        parcel.pick_name,    pick_contact: parcel.pick_contact,
    pick_addr1:       parcel.pick_addr1,   pick_city:    parcel.pick_city,
    pick_state:       parcel.pick_state,   pick_postcode:parcel.pick_postcode,
    send_name:        parcel.send_name,    send_contact: parcel.send_contact,
    send_email:       parcel.send_email,
    send_addr1:       parcel.send_addr1,   send_city:    parcel.send_city,
    send_state:       parcel.send_state,   send_postcode:parcel.send_postcode,
    is_demo:          isDemo,
  }).select('id').single()
  
  if (dbErr) console.error('EP save error:', dbErr)

  if (orderId && success.awb) {
    await supabase.from('orders').update({
      tracking_number:   success.awb,
      tracking_url:      success.tracking_url,
      delivery_status:   'picked_up', 
      delivery_provider: 'easyparcel',
    }).eq('id', orderId)
    
    // Note: The guide said shipping_status: 'shipped', but the schema uses order status enums and delivery_status
  }

  return NextResponse.json({ ok: true, shipment: { ...success, db_id: saved?.id } })
}
