import { streamText }      from 'ai'
import { google }          from '@ai-sdk/google'
import { createClient }    from '@supabase/supabase-js'
import { buildContextMessages, createSession, saveMessages, touchSession,
         AgentTracer, checkRateLimit } from '@project1/agent'

// Hyperlocal uses a curated subset of tools — only what matters for same-day ops
import { listOrders, getOrderDetails, updateOrderStatus } from '@project1/agent/src/tools/orders'
import { checkDeliveryRates, createLalamoveBooking,
         getShipmentTracking, cancelShipment }            from '@project1/agent/src/tools/logistics'
import { verifyPaymentStatus, createPaymentLink }         from '@project1/agent/src/tools/payments'
import { getMerchantSnapshot, pushDashboardAlert }        from '@project1/agent/src/tools/automation'

function buildHyperlocalTools(merchantId: string, sessionId: string) {
  return {
    list_orders:             listOrders(merchantId, sessionId),
    get_order_details:       getOrderDetails(merchantId, sessionId),
    update_order_status:     updateOrderStatus(merchantId, sessionId),
    check_delivery_rates:    checkDeliveryRates(merchantId, sessionId),
    create_lalamove_booking: createLalamoveBooking(merchantId, sessionId),
    get_shipment_tracking:   getShipmentTracking(merchantId, sessionId),
    cancel_shipment:         cancelShipment(merchantId, sessionId),
    verify_payment_status:   verifyPaymentStatus(merchantId, sessionId),
    create_payment_link:     createPaymentLink(merchantId, sessionId),
    get_merchant_snapshot:   getMerchantSnapshot(merchantId, sessionId),
    push_dashboard_alert:    pushDashboardAlert(merchantId, sessionId)
  }
}

const HYPERLOCAL_SYSTEM_PROMPT = (merchantName: string) => `
You are MerchantMind Hyperlocal, a fast-response delivery operations assistant for ${merchantName}.

## Focus
Same-day and on-demand local deliveries via Lalamove only.
Speed is the priority — respond in under 100 words unless detail is required.

## Rules
- ALWAYS check delivery rates before booking.
- ALWAYS verify payment before booking a shipment.
- For urgent orders, suggest Lalamove MOTORCYCLE for fastest pickup.
- Never suggest EasyParcel — this app is for same-day local delivery only.
- For any non-delivery question, say "Please use the main dashboard for that."

## Formatting
- RM for currency, km for distances, DD/MM/YYYY HH:mm for times
- ✅ success  ⚠️ warning  ❌ error

Now: ${new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}
`.trim()

export const maxDuration = 45

export async function POST(req: Request) {
  // Use service role for backend logic if needed, but here we just need to verify user
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  // In a real Expo API route, you'd get the user from the Authorization header
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })
  
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return new Response('Unauthorized', { status: 401 })

  const limit = checkRateLimit(user.id, 'chat')
  if (!limit.allowed) return new Response('Rate limit exceeded', { status: 429 })

  const { newMessage, sessionId: existingSessionId }
    : { newMessage: string, sessionId?: string } = await req.json()

  const sessionId = existingSessionId ?? await createSession(user.id, newMessage)

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_name')
    .eq('id', user.id)
    .single()

  const messages = await buildContextMessages(sessionId, user.id, newMessage)
  const tracer   = new AgentTracer(user.id, sessionId, 'gemini-1.5-flash', 'hyperlocal')

  const result = streamText({
    model:    google('gemini-1.5-flash'),
    system:   HYPERLOCAL_SYSTEM_PROMPT(profile?.business_name ?? 'Merchant'),
    messages,
    tools:    buildHyperlocalTools(user.id, sessionId),
    maxSteps: 8,    // tighter limit for hyperlocal — speed over depth
    onFinish: async ({ text, usage }: { text: string, usage: any }) => {
      await saveMessages(sessionId, user.id, [
        { role: 'user',      content: newMessage },
        { role: 'assistant', content: text }
      ])
      await touchSession(sessionId)
      await tracer.flush({
        promptTokens:     usage.promptTokens,
        completionTokens: usage.completionTokens,
        steps:            0,
        status:           'completed'
      })
    }
  })

  const response = result.toDataStreamResponse()
  const headers  = new Headers(response.headers)
  headers.set('x-session-id', sessionId)
  return new Response(response.body, { headers, status: response.status })
}
