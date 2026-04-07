import { Hono } from 'hono'
import { Webhook } from 'svix'
import { getSupabaseClient, Bindings } from '../lib/supabase'
import { hmacSha256, hmacSha512 } from '../lib/utils'
import { mapLalamoveStatus, mapLalamoveDriverInfo, buildLalamoveHeaders, getLalamoveBaseUrl } from '../lib/lalamove'
// Agent imports moved to dynamic to avoid boot-time ReferenceError

const webhooks = new Hono<{ Bindings: Bindings }>()

// --- Resend Webhook ---
webhooks.post('/resend', async (c) => {
  const payload = await c.req.text()
  const sig = c.req.header('svix-signature')
  const id = c.req.header('svix-id')
  const timestamp = c.req.header('svix-timestamp')
  const secret = c.env.RESEND_WEBHOOK_SECRET

  // 1. Signature Verification
  if (secret) {
    if (!sig || !id || !timestamp) {
      return c.text('Missing Svix headers', 400)
    }
    const wh = new Webhook(secret)
    try {
      wh.verify(payload, {
        'svix-id': id,
        'svix-timestamp': timestamp,
        'svix-signature': sig,
      })
    } catch (err) {
      console.error('[Resend Webhook] Signature verification failed:', err)
      return c.text('Invalid signature', 401)
    }
  } else {
    console.warn('[Resend Webhook] Skipping verification: RESEND_WEBHOOK_SECRET not set')
  }

  // 2. Process Event
  const body = JSON.parse(payload)
  const eventType = body.type // e.g., email.delivered, email.bounced
  const emailId = body.data.email_id
  if (eventType === 'email.received') {
    c.executionCtx.waitUntil(processInboundEmail(body.data, c.env))
    return c.text('OK')
  }

  const status = eventType.split('.')[1] // delivered, bounced, complained

  if (!emailId || !status) {
    return c.text('Invalid payload', 400)
  }

  const supabase = getSupabaseClient(c.env)

  // 3. Update Email Log
  const { error } = await supabase
    .from('email_logs')
    .update({ 
      status: status,
      metadata: body.data 
    })
    .eq('resend_id', emailId)

  if (error) {
    console.error('[Resend Webhook] Failed to update email_logs:', error)
    return c.text('Database error', 500)
  }

  // 4. Update Campaign Analytics
  const tags = body.data.tags as { name: string; value: string }[] | undefined
  const campaignId = tags?.find(t => t.name === 'campaign_id')?.value

  if (campaignId) {
    const columnMap: Record<string, string> = {
      'delivered': 'total_recipients', // delivered is already tracked at send, but we can sync
      'opened': 'opens',
      'clicked': 'clicks',
      'bounced': 'bounces',
      'complained': 'complaints'
    }

    const column = columnMap[status]
    if (column) {
      // Use raw SQL to increment for atomicity
      await supabase.rpc('increment_campaign_stat', { 
        p_campaign_id: campaignId, 
        p_column: column 
      })
    }
  }

  console.log(`[Resend Webhook] Updated email ${emailId} to status: ${status}`)
  return c.text('OK')
})

// --- Billplz Webhook ---
webhooks.post('/billplz', async (c) => {
  const body = await c.req.text()
  const params = new URLSearchParams(body)
  const xSignature = c.env.BILLPLZ_X_SIGNATURE_KEY

  const keysToSign = [
    'billplz[id]', 'billplz[collection_id]', 'billplz[paid]',
    'billplz[state]', 'billplz[amount]', 'billplz[paid_amount]',
    'billplz[due_at]', 'billplz[email]', 'billplz[mobile]',
    'billplz[name]', 'billplz[url]', 'billplz[reference_1]',
    'billplz[reference_2]'
  ]

  const signedString = keysToSign
    .map(k => `${k}${params.get(k) ?? ''}`)
    .join('|')

  const computedSig = await hmacSha256(xSignature, signedString)
  const receivedSig = params.get('x_signature') ?? ''

  if (computedSig !== receivedSig) {
    console.error('Billplz signature mismatch')
    return c.text('Unauthorized', 401)
  }

  const billId = params.get('billplz[id]') ?? ''
  const paid = params.get('billplz[paid]') === 'true'
  const orderId = params.get('billplz[reference_1]') ?? ''

  const supabase = getSupabaseClient(c.env)
  const eventType = paid ? 'payment_captured' : 'payment_failed'

  // Idempotency
  if (billId) {
    const { data: existing } = await supabase
      .from('payment_events')
      .select('id')
      .eq('gateway', 'billplz')
      .eq('gateway_ref', billId)
      .eq('event_type', eventType)
      .maybeSingle()

    if (existing) return c.text('OK', 200)
  }

  const payload: Record<string, string> = {}
  params.forEach((v, k) => { payload[k] = v })

  await supabase.from('payment_events').insert({
    order_id: orderId || null,
    event_type: eventType,
    gateway: 'billplz',
    gateway_ref: billId,
    raw_payload: payload,
  })

  if (paid && orderId) {
    await supabase.from('orders').update({
      status: 'paid',
      payment_status: 'paid',
      payment_reference: billId,
      paid_at: new Date().toISOString(),
    }).eq('id', orderId).eq('status', 'pending')
  }

  return c.text('OK')
})

// --- Lalamove Webhook ---
webhooks.post('/lalamove', async (c) => {
  try {
    const body = await c.req.json()
    const event = body.data ?? body
    
    const lalamoveOrderId = event.orderId ?? event.order?.id ?? body.orderId
    const lalamoveStatus = event.status ?? event.order?.status ?? body.status
    const eventType = body.eventType ?? event.eventType ?? 'status_update'

    if (!lalamoveOrderId) return c.json({ error: 'No orderId' }, 200)

    const supabase = getSupabaseClient(c.env)
    const { data: order } = await supabase
      .from('orders')
      .select('id, merchant_id, customer_id, driver_assigned_at')
      .eq('lalamove_order_id', lalamoveOrderId)
      .maybeSingle()

    if (!order) return c.json({ error: 'Order not found' }, 200)

    const eventId = c.req.header('x-lalamove-request-id') ?? event.eventId ?? body.eventId ?? `${lalamoveOrderId}_${lalamoveStatus}_${Date.now()}`
    
    // Idempotency
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('provider', 'lalamove')
      .eq('event_id', eventId)
      .maybeSingle()

    if (existingEvent) return c.json({ message: 'Duplicate' })

    await supabase.from('webhook_events').insert({ provider: 'lalamove', event_id: eventId, order_id: order.id })
    await supabase.from('delivery_events').insert({ order_id: order.id, provider: 'lalamove', event_type: eventType, raw_payload: body })

    const { updates, callLoyalty } = mapLalamoveStatus(lalamoveStatus, event)
    
    // Driver Details extraction
    const driverId = event.driverId ?? event.order?.driverId ?? body.driverId
    if (driverId && (!event.driver?.name)) {
      try {
        const env = c.env.LALAMOVE_SANDBOX === 'true' ? 'sandbox' : 'production'
        const baseUrl = getLalamoveBaseUrl(env)
        const driverPath = `/v3/orders/${lalamoveOrderId}/drivers/${driverId}`
        const headers = await buildLalamoveHeaders(c.env.LALAMOVE_API_KEY, c.env.LALAMOVE_API_SECRET, 'GET', driverPath, '', 'MY')
        const drvRes = await fetch(`${baseUrl}${driverPath}`, { headers })
        if (drvRes.ok) {
          const drvData = (await drvRes.json()) as any
          if (drvData.data) Object.assign(updates, mapLalamoveDriverInfo(drvData.data))
        }
      } catch (err) {}
    }

    if (Object.keys(updates).length > 1) {
      await supabase.from('orders').update(updates).eq('id', order.id)
    }

    // Secondary actions (Loyalty/Push) via Bridge to existing functions for now
    if (callLoyalty) {
      c.executionCtx.waitUntil(
        fetch(`${c.env.SUPABASE_URL}/functions/v1/award-loyalty-points`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${c.env.SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ orderId: order.id })
        })
      )
    }

    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ error: err.message }, 200)
  }
})

// --- Razorpay Webhook ---
webhooks.post('/razorpay', async (c) => {
  const body = await c.req.text()
  const signature = c.req.header('x-razorpay-signature') ?? ''
  const eventBody = JSON.parse(body)
  const supabase = getSupabaseClient(c.env)

  const merchantId = eventBody.payload?.payment?.entity?.notes?.merchant_id
  let secret = c.env.INTERNAL_SECRET // Default or fallback

  // Extract secret from merchant config if available
  if (merchantId) {
    const { data: config } = await supabase.from('merchant_razorpay_config').select('webhook_secret').eq('merchant_id', merchantId).single()
    if (config?.webhook_secret) secret = config.webhook_secret
  }

  const expected = await hmacSha256(secret, body)
  if (expected !== signature) return c.text('Unauthorized', 401)

  const gatewayRef = eventBody.payload?.payment?.entity?.id
  const eventType = eventBody.event
  const orderId = eventBody.payload?.payment?.entity?.notes?.hyperlocal_order_id

  // Log and Update
  await supabase.from('payment_events').insert({
    order_id: orderId || null,
    event_type: eventType,
    gateway: 'razorpay',
    gateway_ref: gatewayRef,
    raw_payload: eventBody,
  })

  if (eventType === 'payment.captured' && orderId) {
    await supabase.from('orders').update({
      status: 'paid',
      payment_status: 'paid',
      payment_reference: gatewayRef,
      paid_at: new Date().toISOString(),
    }).eq('id', orderId).eq('status', 'pending')
  }

  return c.json({ received: true })
})

// --- Helpers for Inbound Email ---

async function processInboundEmail(
  data: { email_id: string; message_id: string; from: string; to: string[]; subject: string },
  env: Bindings
) {
  const supabase = getSupabaseClient(env)
  
  // Inject environment variables for tools/packages that still rely on process.env
  // (Legacy check for Cloudflare Worker nodejs_compat environment)
  if (typeof process !== 'undefined' && process.env) {
    process.env.SUPABASE_URL = env.SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
    process.env.RESEND_API_KEY = env.RESEND_API_KEY
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = env.GOOGLE_GENERATIVE_AI_API_KEY
  }

  const recipient = data.to[0]
  let logId: string | undefined
  try {

    // 1. Fetch the full email content from Resend
    // NOTE: Inbound emails require the /receiving/ segment in the URL
    const res = await fetch(`https://api.resend.com/emails/receiving/${data.email_id}`, {
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}` }
    })
    if (!res.ok) throw new Error(`Failed to fetch email from Resend: ${res.statusText}`)
    
    const emailData = (await res.json()) as any
    const body = emailData.text || emailData.html || ''
    
    // Extract basic attachment metadata (names/types)
    const attachments = (emailData.attachments || []).map((a: any) => ({
      filename: a.filename,
      contentType: a.contentType
    }))

    // 2. Identify the merchant or platform support
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, owner_id, store_name, inbound_email, support_inbound_email')
      .or(`inbound_email.eq.${recipient},support_inbound_email.eq.${recipient}`)
      .maybeSingle()

    // 2. Identify the agent type
    // It's support if the address explicitly matches the support config OR starts with support@
    const isSupport = (merchant && merchant.support_inbound_email === recipient) || 
                     recipient.toLowerCase().startsWith('support@')

    // 2.5 Log the receipt in email_logs
    const { data: logEntry, error: logError } = await supabase.from('email_logs').insert({
      resend_id: data.email_id,
      recipient: recipient,
      status: 'received',
      template: 'inbound',
      metadata: { 
        from: data.from, 
        subject: data.subject, 
        message_id: data.message_id,
        attachments
      }
    }).select('id').single()

    logId = logEntry?.id
    if (logError) console.error('[InboundEmail] Warning: Initial log capture failed:', logError.message)

    // 3. Resolve or Create Session & Route
    let sessionId: string | undefined
    let sessionMetadata: any
    let replyText: string | null = null
    let responseText: string | null = null // for perfect threading tracking

    if (isSupport || !merchant) {
      // --- Support Agent Path ---
      const { data: supportSession } = await supabase
        .from('support_sessions')
        .select('id, metadata')
        .or(`customer_email.eq."${data.from}",metadata->>email.eq."${data.from}"`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      sessionId = supportSession?.id
      sessionMetadata = supportSession?.metadata || { channel: 'email', email: data.from, references: [] }
      
      const references = Array.isArray(sessionMetadata.references) ? [...sessionMetadata.references] : []
      if (!references.includes(data.message_id)) references.push(data.message_id)
      sessionMetadata.references = references

      // Merchant UUID fallback for support (platform level or specific)
      const targetMerchantId = merchant?.id || null
      const targetOwnerId = merchant?.owner_id || null

      if (!sessionId) {
        console.log(`[InboundEmail] Creating new support session for ${data.from}`)
        const { data: newS, error: newSError } = await supabase.from('support_sessions').insert({
          merchant_id: targetOwnerId,
          customer_email: data.from,
          source: 'email',
          metadata: sessionMetadata
        }).select('id').single()
        
        if (newSError) {
          console.error('[InboundEmail] Failed to create support session:', newSError.message)
          await supabase.from('email_logs').insert({
            resend_id: data.email_id,
            recipient: recipient,
            status: 'error',
            template: 'session-creation',
            error: newSError.message,
            metadata: { step: 'session-creation-failed', targetOwnerId }
          })
          return
        }
        sessionId = newS?.id
      } else {
        await supabase.from('support_sessions').update({ metadata: sessionMetadata }).eq('id', sessionId)
      }

      if (!sessionId) {
        console.error('[InboundEmail] Could not resolve sessionId — aborting')
        return
      }

      if (logId) {
        await supabase.from('email_logs').update({
          status: 'processing',
          template: 'agent-start',
          metadata: { step: 'support-agent-start', sessionId }
        }).eq('id', logId)
      }

      const { handleSupportEmailInput } = await import('@project1/support-agent')
      console.log(`[InboundEmail] Calling handleSupportEmailInput for ${sessionId}...`)
      const result = await handleSupportEmailInput({
        from: data.from,
        subject: data.subject,
        body,
        merchantId: targetMerchantId,
        ownerId: targetOwnerId,
        merchantName: merchant?.store_name || 'Hyperlocal',
        sessionId: sessionId!,
        attachments,
        supabase,
        googleApiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
        logId
      })
      replyText = result.replyText
    } else {
      // --- Merchant Agent Path ---
      const { data: existingSession } = await supabase
        .from('agent_sessions')
        .select('id, metadata')
        .eq('merchant_id', merchant.owner_id)
        .eq('metadata->>email', data.from)
        .maybeSingle()

      sessionId = existingSession?.id
      sessionMetadata = existingSession?.metadata || { channel: 'email', email: data.from, references: [] }
      
      const references = Array.isArray(sessionMetadata.references) ? [...sessionMetadata.references] : []
      if (!references.includes(data.message_id)) references.push(data.message_id)
      sessionMetadata.references = references

      if (!sessionId) {
        const { data: newS } = await supabase.from('agent_sessions').insert({
          merchant_id: merchant.owner_id,
          title: `Email from ${data.from}`,
          metadata: sessionMetadata
        }).select('id').single()
        sessionId = newS?.id
      } else {
        await supabase.from('agent_sessions').update({ metadata: sessionMetadata }).eq('id', sessionId)
      }

      console.log(`[InboundEmail] Dynamically importing @project1/agent for ${sessionId}...`)
      let handleEmailInput: any
      try {
        const module = await import('@project1/agent')
        handleEmailInput = module.handleEmailInput
        console.log(`[InboundEmail] Package @project1/agent imported successfully for ${sessionId}`)
      } catch (importErr: any) {
        console.error(`[InboundEmail] FAILED to import @project1/agent:`, importErr.message)
        await supabase.from('email_logs').insert({
          resend_id: data.email_id,
          recipient: recipient,
          status: 'error',
          template: 'import-failure',
          error: importErr.message,
          metadata: { step: 'import-merchant-agent-package', stack: importErr.stack }
        })
        return
      }

      const result = await handleEmailInput({
        from: data.from,
        subject: data.subject,
        body,
        merchantId: merchant.id,
        ownerId: merchant.owner_id,
        merchantName: merchant.store_name,
        sessionId: sessionId!,
        attachments,
        supabase,
        googleApiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
        logId
      })
      replyText = result.replyText
    }

    if (!replyText) {
      console.warn(`[InboundEmail] Agent produced empty reply for session ${sessionId}`)
      return
    }

    // 5. Send Reply
    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: merchant ? `${merchant.store_name} <${recipient}>` : `Support <${recipient}>`,
        to: data.from,
        subject: data.subject.toLowerCase().startsWith('re:') ? data.subject : `Re: ${data.subject}`,
        text: replyText,
        headers: {
          'In-Reply-To': data.message_id,
          'References': sessionMetadata.references.join(' ')
        }
      })
    })

    if (!sendRes.ok) {
      const errText = await sendRes.text()
      console.error(`[InboundEmail] Failed to send reply: ${errText}`)
      if (logId) {
        await supabase.from('email_logs').update({
          status: 'failed',
          error: `Resend Send Error: ${errText}`,
          metadata: { parent_email_id: data.email_id, session_id: sessionId }
        }).eq('id', logId)
      }
    } else {
      const sendData = (await sendRes.json()) as any
      
      // --- Perfect Threading: Fetch the sent message_id ---
      // We do this in a background task to not block the current flow (already in waitUntil)
      try {
        const sentRes = await fetch(`https://api.resend.com/emails/${sendData.id}`, {
          headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}` }
        })
        const sentEmailData = (await sentRes.json()) as any
        if (sentEmailData.message_id) {
          sessionMetadata.references.push(sentEmailData.message_id)
          const table = (isSupport || !merchant) ? 'support_sessions' : 'agent_sessions'
          await supabase.from(table).update({ metadata: sessionMetadata }).eq('id', sessionId!)
        }
      } catch (err) {
        console.warn(`[InboundEmail] Failed to fetch sent message_id for threading:`, err)
      }

      if (logId) {
        await supabase.from('email_logs').update({
          resend_id: sendData.id, // Update with the OUTBOUND email ID
          status: 'sent',
          template: 'agent-reply',
          metadata: { parent_email_id: data.email_id, session_id: sessionId }
        }).eq('id', logId)
      }
    }

  } catch (err: any) {
    console.error('[InboundEmail] Critical Error:', err.message)
    // Log critical error to email_logs for debugging
    try {
      if (logId) {
        await supabase.from('email_logs').update({
          status: 'failed',
          error: err.message,
          metadata: { step: 'critical-background-failure', stack: err.stack, recipient }
        }).eq('id', logId)
      }
    } catch (logErr: any) {
      console.error('[InboundEmail] Double Fault — failed to log error to DB:', logErr.message)
    }
  }
}


export default webhooks
