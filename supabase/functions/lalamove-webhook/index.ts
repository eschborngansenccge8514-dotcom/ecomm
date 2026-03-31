import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { mapLalamoveStatus } from '../_shared/utils.ts'

// Deploy: supabase functions deploy lalamove-webhook --no-verify-jwt
serve(async (req) => {
  try {
    const rawBody = await req.text()
    const body = JSON.parse(rawBody)
    const event = body.data ?? body
    
    // Extract eventId for idempotency
    // Lalamove webhooks usually provide a unique ID or timestamp
    const eventId = req.headers.get('x-lalamove-request-id') ?? event.eventId ?? body.eventId ?? `evt_${Date.now()}`
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Idempotency Check
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('provider', 'lalamove')
      .eq('event_id', eventId)
      .single()

    if (existingEvent) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const lalamoveOrderId = event.orderId ?? event.order?.id

    // 2. Find our order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, driver_assigned_at, merchant_id, customer_id, total_amount')
      .eq('lalamove_order_id', lalamoveOrderId)
      .single()

    if (orderError || !order) {
      console.error('Order not found for Lalamove ID:', lalamoveOrderId)
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 200, // Still return 200 to acknowledge receipt
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 3. Mark event as processed
    await supabase.from('webhook_events').insert({
      provider: 'lalamove',
      event_id: eventId,
      order_id: order.id
    })

    // 4. Log the event
    await supabase.from('delivery_events').insert({
      order_id:    order.id,
      provider:    'lalamove',
      event_type:  body.eventType ?? 'status_update',
      raw_payload: body,
    })

    // 5. Processing logic
    const lalamoveStatus = event.status ?? body.status
    const { updates: mappedUpdates, callLoyalty } = mapLalamoveStatus(lalamoveStatus, event)
    
    // Merge updates
    const updates = { ...mappedUpdates, updated_at: new Date().toISOString() }

    // Special handling for CANCELLED (as per plan's specific requirements)
    if (lalamoveStatus === 'CANCELLED') {
      updates.lalamove_cancel_reason = event.reason ?? 'Cancelled by provider'
    }

    // Special handling for ASSIGNING_DRIVER (plan: set if not set)
    if (lalamoveStatus === 'ASSIGNING_DRIVER' && !order.driver_assigned_at) {
      updates.driver_assigned_at = new Date().toISOString()
    }
    if (event.driverInfo && !updates.driver_assigned_at && !order.driver_assigned_at) {
      updates.driver_assigned_at = new Date().toISOString()
    }

    // Apply updates
    if (Object.keys(updates).length > 1) { // More than just updated_at
      await supabase.from('orders').update(updates).eq('id', order.id)
    }

    // 6. Handle side effects (Async if possible, but simpler to just await here for now)
    if (callLoyalty) {
      try {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/award-loyalty-points`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({ orderId: order.id })
        })
      } catch (e) {
        console.error('Failed to award loyalty points:', e)
      }
    }

    // 7. Push Notifications (Epic 6.3)
    const notificationMap: Record<string, { title: string, body: string, screen?: string }> = {
      'ASSIGNING_DRIVER': { title: '🏍️ Finding your driver...', body: 'Searching for a driver for your order.' },
      'PICKED_UP': { title: 'Your order is out for delivery 🚀', body: 'The driver has picked up your order.' },
      'COMPLETED': { title: '⭐ How was your order?', body: 'Tap to rate your experience. It only takes 5 seconds!', screen: 'review' },
      'CANCELLED': { title: 'Delivery cancelled', body: 'We are finding a new driver for you.' }
    }


    if (updates.exception_flag === 'driver_not_found') {
      notificationMap['REJECTED'] = { title: 'Still searching...', body: 'We are still searching for a driver. Please wait.' }
    }

    const pushInfo = notificationMap[lalamoveStatus] || (updates.exception_flag === 'driver_not_found' ? notificationMap['REJECTED'] : null)

    if (pushInfo) {
      try {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            userId: order.customer_id,
            title: pushInfo.title,
            body: pushInfo.body,
            data: { 
              orderId: order.id,
              screen:  pushInfo.screen 
            }
          })

        })
      } catch (e) {
        console.error('Failed to send push notification:', e)
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Webhook Error:', error)
    // Always return 200 to Lalamove to prevent retries on internal logic errors
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

