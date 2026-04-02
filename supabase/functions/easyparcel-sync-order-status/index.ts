import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callEasyParcel } from '../_shared/easyparcel.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const payload = await req.json().catch(() => ({}))
    const manualOrderId = payload?.order_id

    // 1. Get shipments to sync
    let pendingShipments: any[] = []
    
    if (manualOrderId) {
      const { data } = await supabase
        .from('easyparcel_shipments')
        .select('id, ep_order_number, order_status, merchant_id, order_id')
        .eq('order_id', manualOrderId)
      pendingShipments = data || []
    } else {
      const { data } = await supabase
        .from('easyparcel_shipments')
        .select('id, ep_order_number, order_status, merchant_id, order_id')
        .or('order_status.in.("Waiting Payment","Undefined Status"),awb.eq."Awb not available",awb.is.null')
        .not('ep_order_number', 'is', null)
        .limit(50)
      pendingShipments = data || []
    }

    // 2. Look for orders that HAVE an ep_order_number but NO easyparcel_shipments record
    // This happens if the creation function failed to insert into the shipments table
    const filteredMissing = []
    if (!manualOrderId) {
      const { data: missingRecords } = await supabase
        .from('orders')
        .select('id, easyparcel_order_no, merchant_id')
        .not('easyparcel_order_no', 'is', null)
        .limit(50)
      
      if (missingRecords) {
        for (const order of missingRecords) {
          const { count } = await supabase
            .from('easyparcel_shipments')
            .select('*', { count: 'exact', head: true })
            .eq('ep_order_number', order.easyparcel_order_no)
          
          if (count === 0) {
            filteredMissing.push({
              id: null, // New record
              ep_order_number: order.easyparcel_order_no,
              merchant_id: order.merchant_id,
              order_id: order.id,
              is_recovery: true
            })
          }
        }
      }
    }

    const allToSyncArr = [
      ...pendingShipments,
      ...filteredMissing
    ]

    if (allToSyncArr.length === 0) {
      return new Response(JSON.stringify({ message: 'No EasyParcel shipments to sync' }), { 
        headers: { ...CORS, 'Content-Type': 'application/json' } 
      })
    }

    const syncResults = []
    const merchantGroups = allToSyncArr.reduce((acc: any, s) => {
      if (!acc[s.merchant_id]) acc[s.merchant_id] = []
      acc[s.merchant_id].push(s)
      return acc
    }, {})

    for (const merchantId in merchantGroups) {
      const shipments = merchantGroups[merchantId]
      
      const { data: cfg } = await supabase
        .from('merchant_easyparcel_settings')
        .select('*')
        .eq('merchant_id', merchantId).single()

      const config = cfg ? { 
        apiKey: cfg.api_key, 
        environment: cfg.is_demo ? 'sandbox' : 'production' 
      } : undefined

      const orderNumbers = shipments.map((s: any) => ({ order_no: s.ep_order_number }))

      try {
        // Step 1: Check Payment Status
        const statusResult = await callEasyParcel(supabase, null, 'MPOrderStatusBulk', {
          bulk: orderNumbers,
          exclude_fields: ['pgeon_point']
        }, config)

        if (statusResult.api_status === 'Success' && statusResult.result) {
          for (let i = 0; i < statusResult.result.length; i++) {
            const r = statusResult.result[i]
            const shipment = shipments[i]
            
            // If the order is paid, also check Parcel Status to get AWB
            const statusLower = (r.order_status || '').toLowerCase()
            const isPaid = ['fully paid', 'payment done', 'already paid', 'success'].includes(statusLower)
            let parcelInfo: any = null

            if (isPaid) {
              const parcelResult = await callEasyParcel(supabase, null, 'MPParcelStatusBulk', {
                bulk: [{ order_no: shipment.ep_order_number }]
              }, config)
              parcelInfo = parcelResult.result?.[0]
            }

            const upsertData: any = {
              merchant_id:      merchantId,
              ep_order_number:  shipment.ep_order_number,
              order_status:     r.order_status,
              updated_at:       new Date().toISOString()
            }

            if (shipment.order_id) upsertData.order_id = shipment.order_id
            if (parcelInfo) {
              upsertData.awb             = parcelInfo.awb || parcelInfo.awb_no
              upsertData.ep_parcel_number = parcelInfo.parcelno || parcelInfo.parcel_number
              upsertData.ship_status      = parcelInfo.status || parcelInfo.ship_status
              upsertData.courier_name     = parcelInfo.courier_name
              upsertData.tracking_url     = parcelInfo.awb_id_link || parcelInfo.tracking_url
              upsertData.awb_id_link      = parcelInfo.awb_id_link
            }

            await supabase
              .from('easyparcel_shipments')
              .upsert(upsertData, { onConflict: 'ep_order_number' })

            // Also update orders table if AWB found
            if (upsertData.awb && shipment.order_id) {
              await supabase.from('orders').update({
                tracking_number: upsertData.awb,
                tracking_url:    upsertData.tracking_url,
                delivery_status: 'pending' // Move from 'not_requested' or 'failed' to 'pending'
              }).eq('id', shipment.order_id)
            }

            syncResults.push({ 
              order: shipment.ep_order_number, 
              status: r.order_status, 
              awb: upsertData.awb || 'pending' 
            })
          }
        }
      } catch (err: any) {
        console.error(`Error syncing merchant ${merchantId}:`, err.message)
      }
    }

    return new Response(JSON.stringify({ results: syncResults }), { 
      headers: { ...CORS, 'Content-Type': 'application/json' } 
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400, 
      headers: { ...CORS, 'Content-Type': 'application/json' } 
    })
  }
})
