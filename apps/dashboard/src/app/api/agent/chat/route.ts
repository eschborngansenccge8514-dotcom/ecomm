import { runAgent, checkRateLimit, createSession } from '@project1/agent'
import { getAuthContext } from '@/lib/utils.server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let user: any = null
  let merchant: any = null
  let isAdmin = false

  // 1. Try to authenticate from Supabase session cookie (SSR)
  try {
    const auth = await getAuthContext()
    user = auth.user
    merchant = auth.merchant
    isAdmin = auth.isAdmin
  } catch (err) {
    // 2. Fallback to Bearer Token (Mobile)
    const authHeader = req.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const supabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { user: tokenUser } } = await supabase.auth.getUser(token)
      if (tokenUser) {
        user = tokenUser
        const [{ data: m }, { data: p }] = await Promise.all([
          supabase.from('merchants').select('*').eq('owner_id', tokenUser.id).single(),
          supabase.from('profiles').select('*').eq('id', tokenUser.id).single()
        ])
        merchant = m
        isAdmin = p?.role === 'admin'
      }
    }
  }

  if (!user || (!merchant && !isAdmin)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

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
  const { sessionId: existingSessionId, messages, merchantId: bodyMerchantId, stream } = body

  // Extract newMessage — if not present, get it from the standard messages array (AI SDK useChat)
  let newMessage = body.newMessage
  if (!newMessage && Array.isArray(messages) && messages.length > 0) {
    const lastMsg = messages[messages.length - 1]
    if (lastMsg.role === 'user') newMessage = lastMsg.content
  }

  // Use a virtual merchant ID for admins if needed, but normally they should have a merchant context or be restricted
  // If admin, prioritize merchantId from body (so they can scope the chat)
  const effectiveMerchantId = merchant?.id || bodyMerchantId || (isAdmin ? 'admin' : null)
  if (!effectiveMerchantId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  // Ensure standard extraction
  if (!newMessage?.trim()) return new Response(JSON.stringify({ error: 'Empty message' }), { status: 400 })
  
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
      sessionId,
      stream: stream !== false // Explicitly check for false, default to true
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
