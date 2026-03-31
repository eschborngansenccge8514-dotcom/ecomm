import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Import shared utilities
// @ts-ignore
import { MarketplaceProvider, getSupabaseClient } from '../_shared/marketplace.ts'

/**
 * Unified Edge Function to handle all marketplace webhooks.
 * Route: /functions/v1/marketplace-webhook-handler
 */
serve(async (req) => {
  const url = new URL(req.url)
  const provider = url.searchParams.get('provider') as MarketplaceProvider

  if (!provider) {
    return new Response(JSON.stringify({ error: 'Missing provider query parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = getSupabaseClient()
    const rawBody = await req.text()
    const payload = JSON.parse(rawBody)

    // 1. Signature Verification (Placeholder)
    // Each provider has a unique verification logic.
    // For Phase 1, we log the attempt and skip verification unless secrets are provided.
    console.log(`Received webhook from ${provider}:`, payload)

    // 2. Extract external event ID for idempotency
    let externalEventId: string | null = null
    let eventType: string = 'unknown'

    if (provider === 'shopee') {
      externalEventId = payload.request_id || payload.update_time?.toString()
      eventType = payload.code?.toString() || 'shopee_event'
    } else if (provider === 'tiktok') {
      externalEventId = payload.event_id
      eventType = payload.type
    } else {
      externalEventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      eventType = 'generic_event'
    }

    // 3. Mark event as pending/received in marketplace_events
    // This provides a log for debugging and idempotency.
    const { error: insertError } = await supabase
      .from('marketplace_events')
      .insert({
        provider_id: provider,
        external_event_id: externalEventId,
        event_type: eventType,
        payload: payload,
        status: 'pending'
      })

    if (insertError && insertError.code === '23505') {
      // Duplicate event (Unique constraint violation)
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 4. Enqueue processing job (Placeholder)
    // For Phase 1, we just return 200 after logging.
    // In Phase 2, we would insert into marketplace_sync_jobs to process asynchronously.

    return new Response(JSON.stringify({ success: true, event_id: externalEventId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Webhook Handler Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
