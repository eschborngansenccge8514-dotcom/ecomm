import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildLalamoveHeaders, getLalamoveBaseUrl } from '../_shared/lalamove-auth.ts'
import { mapLalamoveStatus, mapLalamoveDriverInfo } from '../_shared/utils.ts'

// Deploy: supabase functions deploy lalamove-webhook --no-verify-jwt
serve(async (req) => {
  try {
    const rawBody = await req.text()
    const body = JSON.parse(rawBody)
    const event = body.data ?? body
    
    // 1. Extract IDs and Status
    const lalamoveOrderId = event.orderId ?? event.order?.id ?? body.orderId
    const lalamoveStatus  = event.status  ?? event.order?.status ?? body.status
    const eventType       = body.eventType ?? event.eventType ?? 'status_update'

    if (!lalamoveOrderId) {
      console.error('[lalamove-webhook] No Lalamove Order ID found in payload')
      return new Response(JSON.stringify({ error: 'No orderId' }), { status: 200 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 2. Find the local order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, merchant_id, status, delivery_status, customer_id, driver_assigned_at')
      .eq('lalamove_order_id', lalamoveOrderId)
      .maybeSingle()

    if (orderError || !order) {
      console.error('[lalamove-webhook] Order not found for Lalamove ID:', lalamoveOrderId)
      return new Response(JSON.stringify({ error: 'Order not found' }), { status: 200 })
    }

    // 3. Idempotency Check
    const eventId = req.headers.get('x-lalamove-request-id') ?? event.eventId ?? body.eventId ?? `${lalamoveOrderId}_${lalamoveStatus}_${Date.now()}`
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('provider', 'lalamove')
      .eq('event_id', eventId)
      .maybeSingle()

    if (existingEvent) {
      return new Response(JSON.stringify({ message: 'Duplicate event' }), { status: 200 })
    }

    // 4. Record the event
    await supabase.from('webhook_events').insert({
      provider: 'lalamove',
      event_id: eventId,
      order_id: order.id,
    })

    await supabase.from('delivery_events').insert({
      order_id:    order.id,
      provider:    'lalamove',
      event_type:  eventType,
      raw_payload: body,
    })

    // 5. Map Status and Drivers
    const { updates, callLoyalty } = mapLalamoveStatus(lalamoveStatus, event)
    updates.updated_at = new Date().toISOString()
    
    // Driver info extraction
    const driverId    = event.driverId    ?? event.order?.driverId ?? body.driverId
    const driverName  = event.driver?.name  ?? event.order?.driver?.name
    const driverPhone = event.driver?.phone ?? event.order?.driver?.phone
    const driverPlate = event.driver?.plateNumber ?? event.order?.driver?.plateNumber
    const driverPhoto = event.driver?.photoUrl    ?? event.order?.driver?.photoUrl

    if (driverName)  updates.driver_name  = driverName
    if (driverPhone) updates.driver_phone = driverPhone
    if (driverPlate) updates.driver_plate = driverPlate
    if (driverPhoto) updates.driver_photo_url = driverPhoto

    // Special handling for ASSIGNING_DRIVER / ON_GOING
    if ((lalamoveStatus === 'ASSIGNING_DRIVER' || lalamoveStatus === 'ON_GOING') && !order.driver_assigned_at) {
      updates.driver_assigned_at = new Date().toISOString()
    }

    // 6. Extended Driver Details Fetch (if we have ID but missing name/photo)
    if (driverId && (!driverName || !driverPhoto)) {
      try {
        console.log(`[lalamove-webhook] Fetching extended details for driver ${driverId}...`)
        const apiKey    = Deno.env.get('LALAMOVE_API_KEY')!
        const apiSecret = Deno.env.get('LALAMOVE_API_SECRET')!
        const market    = Deno.env.get('LALAMOVE_MARKET') || 'MY'
        const env       = Deno.env.get('DELIVERY_ENV')   || 'sandbox'
        const baseUrl   = getLalamoveBaseUrl(env)

        const driverPath = `/v3/orders/${lalamoveOrderId}/drivers/${driverId}`
        const headers = await buildLalamoveHeaders(apiKey, apiSecret, 'GET', driverPath, '', market)
        const drvRes  = await fetch(`${baseUrl}${driverPath}`, { headers })
        
        if (drvRes.ok) {
          const drvData = await drvRes.json()
          if (drvData.data) {
            const driverUpdates = mapLalamoveDriverInfo(drvData.data)
            Object.assign(updates, driverUpdates)
          }
        }
      } catch (err) {
        console.error('[lalamove-webhook] Driver details fetch failed:', err)
      }
    }

    // 7. Apply updates to Database
    if (Object.keys(updates).length > 1) { 
      const { error: updateErr } = await supabase.from('orders').update(updates).eq('id', order.id)
      if (updateErr) console.error('[lalamove-webhook] Order update error:', updateErr)
    }

    // 8. Loyalty Points Side Effect
    if (callLoyalty) {
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/award-loyalty-points`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({ orderId: order.id })
      }).catch(e => console.error('[lalamove-webhook] Loyalty fetch error:', e))
    }

    // 9. Push Notifications
    const notificationMap: Record<string, { title: string, body: string, screen?: string }> = {
      'ASSIGNING_DRIVER': { title: '🏍️ Finding your driver...', body: 'Searching for a driver for your order.' },
      'PICKED_UP': { title: 'Your order is out for delivery 🚀', body: 'The driver has picked up your order.' },
      'COMPLETED': { title: '⭐ How was your order?', body: 'Tap to rate your experience. It only takes 5 seconds!', screen: 'review' },
      'CANCELLED': { title: 'Delivery cancelled', body: 'We are finding a new driver for you.' }
    }

    const pushInfo = notificationMap[lalamoveStatus]
    if (pushInfo) {
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          userId: order.customer_id,
          title: pushInfo.title,
          body: pushInfo.body,
          data: { orderId: order.id, screen: pushInfo.screen }
        })
      }).catch(e => console.error('[lalamove-webhook] Push fetch error:', e))
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('[lalamove-webhook] Critical Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200, // Return 200 to acknowledge receipt even on internal error
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
