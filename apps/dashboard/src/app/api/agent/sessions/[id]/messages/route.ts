import { getAuthContext } from '@/lib/utils.server'
import { loadMessages } from '@project1/agent'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params
  let user: any = null
  let merchant: any = null
  let isAdmin = false

  // 1. Try SSR session
  try {
    const auth = await getAuthContext()
    user = auth.user
    merchant = auth.merchant
    isAdmin = auth.isAdmin
  } catch (err) {
    // 2. Fallback to Bearer (Mobile)
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

  if (!user || (!merchant && !isAdmin)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })

  // Use a simple client for ownership check
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )

  try {
    // Verify ownership
    const { data: session, error: sessionError } = await supabase
      .from('agent_sessions')
      .select('merchant_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return new Response('Session not found', { status: 404 })
    }

    if (session.merchant_id !== user.id) {
      return new Response('Forbidden', { status: 403 })
    }

    // Load messages
    // Note: loadMessages uses the service role from @project1/agent context correctly
    const messages = await loadMessages(sessionId)
    
    return Response.json(messages)
  } catch (err: any) {
    console.error('[API] Get Messages Error:', err)
    return new Response(err.message, { status: 500 })
  }
}
