import { streamText, stepCountIs } from 'ai'
import { google } from '@ai-sdk/google'
import { createClient } from '@supabase/supabase-js'

import { buildSupportTools } from './tools'
import { buildSupportSystemPrompt } from './prompts/system'
import {
  loadSupportMessages,
  saveSupportMessages,
  touchSupportSession
} from './memory/messages'

export interface SupportAgentInput {
  newMessage: string
  sessionId: string
  merchantId: string
  customerId?: string // The authenticated customer's user UUID
  customerEmail?: string
  customerName?: string
  orderId?: string // Optional: to start chat in context of a specific order
}

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function runSupportAgent({
  newMessage,
  sessionId,
  merchantId,
  customerId,
  customerEmail,
  customerName,
  orderId
}: SupportAgentInput): Promise<Response> {
  const t0 = Date.now()
  console.log(`[SupportAgent] START session=${sessionId} msg="${newMessage.slice(0, 40)}"`)

  const supabase = getSupabase()

  // Step 1: Resolve Merchant Context (handle both User/Owner ID and Merchant UUID)
  // We need both: 
  // - Merchant UUID (for querying business data like orders, products)
  // - Owner ID (for querying support sessions, configuration)
  let merchantUuid = merchantId
  let ownerId = merchantId
  let merchantName = 'this store'

  // Try to find merchant by owner_id (standard path from dashboard)
  const { data: m1 } = await supabase
    .from('merchants')
    .select('id, owner_id, store_name')
    .eq('owner_id', merchantId)
    .maybeSingle()

  if (m1) {
    merchantUuid = m1.id
    ownerId = m1.owner_id
    merchantName = m1.store_name
    console.log(`[SupportAgent] Resolved merchant context by owner_id: uuid=${merchantUuid} owner=${ownerId}`)
  } else {
    // Fallback: Try by id (UUID path from initial customer contact)
    const { data: m2 } = await supabase
      .from('merchants')
      .select('id, owner_id, store_name')
      .eq('id', merchantId)
      .maybeSingle()

    if (m2) {
      merchantUuid = m2.id
      ownerId = m2.owner_id
      merchantName = m2.store_name
      console.log(`[SupportAgent] Resolved merchant context by UUID: uuid=${merchantUuid} owner=${ownerId}`)
    } else {
      console.warn(`[SupportAgent] Could not resolve merchant: ${merchantId}. Using defaults.`)
    }
  }

  // 1. Fetch support config, session state, and customer context in parallel
  // NEW: Resolve customerId from email if missing
  let resolvedCustomerId = customerId
  if (!resolvedCustomerId && customerEmail) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', customerEmail)
      .maybeSingle()
    if (profile) {
      resolvedCustomerId = profile.id
      console.log(`[SupportAgent] Resolved customerId from email: ${customerEmail} -> ${resolvedCustomerId}`)
    }
  }

  const [configRes, sessionRes, customerContext] = await Promise.all([
    supabase
      .from('support_configs')
      .select('welcome_message, ai_enabled, knowledge_base_text')
      .eq('merchant_id', ownerId)
      .maybeSingle(),
    supabase
      .from('support_sessions')
      .select('is_ai_handling, status')
      .eq('id', sessionId)
      .single(),
    // Pre-fetch context (recent orders or specific order) using customer_id
    (async () => {
      let context = ""
      if (customerName || customerEmail) {
        context += `\nCUSTOMER: ${customerName ?? 'Unknown'} (${customerEmail ?? 'No email'})`
      }

      if (orderId) {
        const { data: order } = await supabase
          .from('orders')
          .select('order_number, status, created_at, delivery_status')
          .eq('merchant_id', merchantUuid)
          .eq('id', orderId)
          .maybeSingle()
        if (order) {
          context += `\n- ACTIVE TOPIC: Order #${order.order_number} (Status: ${order.status}, Delivery: ${order.delivery_status ?? 'N/A'})`
        }
      }

      // Pre-fetch by customer_id (reliable, since buyer_email is not stored on orders)
      if (resolvedCustomerId) {
        const { data: recent } = await supabase
          .from('orders')
          .select('order_number, status, created_at, delivery_status')
          .eq('merchant_id', merchantUuid)
          .eq('customer_id', resolvedCustomerId)
          .order('created_at', { ascending: false })
          .limit(3)

        if (recent && recent.length > 0) {
          context += `\n- RECENT ORDERS (use order_number to look up details):`
          recent.forEach(o => {
            context += `\n  * #${o.order_number} | Status: ${o.status} | Delivery: ${o.delivery_status ?? 'N/A'} | Date: ${new Date(o.created_at).toLocaleDateString()}`
          })
        }
      }
      return context
    })()
  ])

  // Use defaults if no config row exists yet (merchant hasn't configured support)
  const ai_enabled = configRes.data?.ai_enabled ?? true
  const knowledge_base_text = configRes.data?.knowledge_base_text ?? null

  // 2. Check if AI should even respond
  const isAiHandling = sessionRes.data?.is_ai_handling ?? true
  if (!ai_enabled || !isAiHandling) {
    console.log(`[SupportAgent] AI disabled OR human taken over. session=${sessionId} (enabled=${ai_enabled}, handling=${isAiHandling})`)
    return new Response(JSON.stringify({
      error: 'AI is currently disabled for this session. A human agent will be with you shortly.'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  // 3. Load message history for context
  let messages: any[]
  try {
    const historical = await loadSupportMessages(sessionId, 20, supabase)
    messages = [...historical, { role: 'user', content: newMessage }]
    console.log(`[SupportAgent] Loaded history OK (${Date.now() - t0}ms) — ${historical.length} msgs`)
  } catch (e) {
    console.error(`[SupportAgent] Failed to load message history for session ${sessionId}:`, e)
    messages = [{ role: 'user', content: newMessage }]
  }

  // 4. Call streamText with lightweight Gemini model
  console.log(`[SupportAgent] calling streamText (${Date.now() - t0}ms)`)
  const result = streamText({
    model: google('gemini-2.5-flash-lite'),
    system: buildSupportSystemPrompt(merchantName, knowledge_base_text, customerContext),
    messages,
    tools: buildSupportTools(merchantUuid, ownerId, sessionId, supabase, resolvedCustomerId) as any,
    stopWhen: stepCountIs(5), // Keep support agent lean

    onFinish: async ({ text, usage, finishReason }) => {
      const u = usage as any
      const inputTok = u.inputTokens ?? u.promptTokens ?? 0
      const outputTok = u.outputTokens ?? u.completionTokens ?? 0
      console.log(`[SupportAgent] onFinish — reason=${finishReason} textLen=${text.length} tokens=${inputTok}/${outputTok}`)

      // Side-effects: save messages and update session activity
      try {
        await Promise.allSettled([
          saveSupportMessages(sessionId, ownerId, [
            { role: 'user', content: newMessage },
            { role: 'assistant', content: text }
          ], supabase),
          touchSupportSession(sessionId, supabase)
        ]).then(results => {
          results.forEach((r, i) => {
            if (r.status === 'rejected') console.error(`[SupportAgent] Side-effect ${i} FAILED:`, r.reason)
          })
        })
        console.log(`[SupportAgent] Side-effects complete for session ${sessionId}`)
      } catch (e) {
        console.error(`[SupportAgent] Side-effects CRITICAL FAILURE for session ${sessionId}:`, e)
      }

      console.log(`[SupportAgent] DONE total=${Date.now() - t0}ms session=${sessionId}`)
    }
  })

  // Return the standard AI SDK UI message stream response (data stream format)
  return result.toUIMessageStreamResponse()
}
