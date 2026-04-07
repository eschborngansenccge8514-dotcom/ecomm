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
    const { orderId } = await req.json().catch(() => ({}))

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get orders that are not yet delivered/cancelled and have an easyparcel order number
    let query = supabase
      .from('orders')
      .select('id, easyparcel_order_no, tracking_number, status, delivery_status')
      .not('easyparcel_order_no', 'is', null)
      .not('status', 'in', '("delivered","cancelled")')
    
    if (orderId) {
      query = query.eq('id', orderId)
    } else {
      query = query.limit(50)
    }

    const { data: activeOrders } = await query

    if (!activeOrders || activeOrders.length === 0) {
      return new Response(JSON.stringify({ message: 'No active EasyParcel orders to sync' }), { 
        headers: { ...CORS, 'Content-Type': 'application/json' } 
      })
    }

    const syncResults = []

    for (const order of activeOrders) {
      try {
        // Fetch per-merchant EasyParcel configuration
        const { data: epConfig } = await supabase
          .from('merchant_easyparcel_config')
          .select('*')
          .eq('merchant_id', order.merchant_id)
          .maybeSingle()

        const epCallConfig = { 
          apiKey:      (epConfig?.is_enabled && epConfig?.api_key) ? epConfig.api_key : Deno.env.get('EASYPARCEL_API_KEY'), 
          authKey:     (epConfig?.is_enabled && (epConfig?.auth_key || epConfig?.api_secret)) ? (epConfig.auth_key || epConfig.api_secret) : Deno.env.get('EASYPARCEL_AUTH_KEY'),
          environment: (epConfig?.is_enabled && epConfig?.environment) ? epConfig.environment : (Deno.env.get('DELIVERY_ENV') || 'sandbox')
        }

        // Phase 5 — Parcel Status (MPParcelStatusBulk)
        const statusData = await callEasyParcel(supabase, order.id, 'MPParcelStatusBulk', {
          bulk: [{ order_no: order.easyparcel_order_no }]
        }, epCallConfig)

        const parcel = statusData.result?.[0]
        if (!parcel) continue

        const shipStatus = parcel.ship_status
        const awb        = parcel.awb

        // Phase 6 — Parcel Tracking (MPTrackingBulk)
        const trackingData = await callEasyParcel(supabase, order.id, 'MPTrackingBulk', {
          bulk: [{ order_no: order.easyparcel_order_no }]
        }, epCallConfig)
        
        const epStatusCode = trackingData.result?.[0]?.ep_status_code

        const updates: any = { updated_at: new Date().toISOString() }
        if (awb && awb !== order.tracking_number) updates.tracking_number = awb
        
        switch (shipStatus) {
          case 'Collected':
            updates.delivery_status = 'picked_up'
            updates.status = 'out_for_delivery'
            break
          case 'Delivering (in transit)':
            updates.delivery_status = 'in_transit'
            updates.status = 'out_for_delivery'
            break
          case 'Successfully Delivered':
            updates.delivery_status = 'delivered'
            updates.status = 'delivered'
            updates.delivered_at = new Date().toISOString()
            break
          case 'Returned':
            updates.delivery_status = 'returned'
            updates.exception_flag = 'api_failure'
            break
          case 'On Hold':
            updates.delivery_status = 'failed'
            updates.exception_flag = 'api_failure'
            break
          case 'Pending For Collection':
            updates.delivery_status = 'pending'
            break
          case 'Waiting Payment':
            updates.delivery_status = 'pending'
            break
        }

        // Refine with numeric statuses if available
        if (epStatusCode == 3) updates.delivery_status = 'picked_up'
        if (epStatusCode == 4) updates.delivery_status = 'in_transit'
        if (epStatusCode == 5 && shipStatus === 'Successfully Delivered') {
          updates.delivery_status = 'delivered'
          updates.status = 'delivered'
        }

        if (Object.keys(updates).length > 1) { // > 1 because updated_at is always there
          await supabase.from('orders').update(updates).eq('id', order.id)
          
          await supabase.from('delivery_events').insert({
            order_id: order.id,
            provider: 'easyparcel',
            event_type: 'status_sync',
            raw_payload: { shipStatus, epStatusCode, statusData, trackingData }
          })
        }

        syncResults.push({ orderId: order.id, orderNo: order.easyparcel_order_no, shipStatus, epStatusCode })

      } catch (err: any) {
        console.error(`Error syncing order ${order.id}:`, err.message)
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
