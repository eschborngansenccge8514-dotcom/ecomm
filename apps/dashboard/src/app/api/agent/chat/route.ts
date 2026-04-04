import { runAgent, checkRateLimit, createSession } from '@project1/agent'
import { getAuthContext } from '@/lib/utils.server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // Authenticate from Supabase session cookie
  const { user, merchant, isAdmin } = await getAuthContext()
  if (!user || (!merchant && !isAdmin)) return new Response('Unauthorized', { status: 401 })

  // Rate limit check (scoped to user)
  const limit = checkRateLimit(user.id, 'chat')
  if (!limit.allowed) {
    return new Response(
      JSON.stringify({
        error:   'Rate limit exceeded',
        message: 'Too many messages. Please wait a moment before sending another.',
        retryAfterMs: limit.retryAfterMs
      }),
      {
        status:  429,
        headers: {
          'Content-Type':  'application/json',
          'Retry-After':   String(Math.ceil((limit.retryAfterMs ?? 60_000) / 1000))
        }
      }
    )
  }

  const body = await req.json()
  const { sessionId: existingSessionId, messages, merchantId: bodyMerchantId } = body

  // Use a virtual merchant ID for admins if needed, but normally they should have a merchant context or be restricted
  // If admin, prioritize merchantId from body (so they can scope the chat)
  const effectiveMerchantId = merchant?.id || bodyMerchantId || (isAdmin ? 'admin' : null)
  if (!effectiveMerchantId) return new Response('Unauthorized', { status: 401 })
  let newMessage = body.newMessage

  // Ensure standard extraction
  if (!newMessage?.trim()) return new Response('Empty message', { status: 400 })
  
  console.log(`[API] Agent Chat: session=${existingSessionId} user=${user.id} merchant=${effectiveMerchantId} msg=${newMessage?.slice(0, 50)}...`)

  // Get or create session - MUST USE user.id for merchant_id column in database (FK says so)
  const sessionId = existingSessionId
    ?? await createSession(user.id, newMessage)

  try {
    const response = await runAgent({
      newMessage,
      userId: user.id,
      merchantId: effectiveMerchantId,
      merchantName: merchant?.store_name ?? 'Merchant',
      sessionId
    })

    response.headers.set('x-session-id', sessionId)
    response.headers.set('Access-Control-Expose-Headers', 'x-session-id')
    response.headers.set('X-Accel-Buffering', 'no') // Disable proxy buffering
    return response
  } catch (err: any) {
    console.error('[API] Agent Error:', err)
    return new Response(JSON.stringify({ error: 'Agent execution failed', details: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
