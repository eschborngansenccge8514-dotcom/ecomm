import { runAgent, checkRateLimit, createSession } from '@project1/agent'
import { createClient }  from '@/lib/supabase/server'

export const maxDuration = 60

export async function POST(req: Request) {
  // Authenticate from Supabase session cookie
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Rate limit check
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
  const { sessionId: existingSessionId, messages } = body
  let newMessage = body.newMessage

  // If using standard useChat append/handleSubmit, the message is in the last index of 'messages'
  if (messages && Array.isArray(messages) && messages.length > 0) {
    newMessage = messages[messages.length - 1].content
  }

  console.log(`[API] Agent Chat: session=${existingSessionId} msg=${newMessage?.slice(0, 50)}...`)

  if (!newMessage?.trim()) return new Response('Empty message', { status: 400 })

  // Get or create session
  const sessionId = existingSessionId
    ?? await createSession(user.id, newMessage)

  // Fetch merchant name
  const { data: profile } = await supabase
    .from('profiles')
    .select('business_name')
    .eq('id', user.id)
    .single()

  try {
    const response = await runAgent({
      newMessage,
      merchantId: user.id,
      merchantName: profile?.business_name ?? 'Merchant',
      sessionId
    })

    response.headers.set('x-session-id', sessionId)
    response.headers.set('Access-Control-Expose-Headers', 'x-session-id')
    return response
  } catch (err: any) {
    console.error('[API] Agent Error:', err)
    return new Response(JSON.stringify({ error: 'Agent execution failed', details: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
