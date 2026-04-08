import { resolveAuth } from '@/lib/utils.server'
import { loadMessages } from '@project1/agent'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params
  const auth = await resolveAuth(req)
  if (!auth || (!auth.merchant && !auth.isAdmin)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  const { user, supabase } = auth

  try {
    // Verify ownership
    const { data: session, error: sessionError } = await supabase
      .from('agent_sessions')
      .select('merchant_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('[API] Session ownership check failed:', sessionError)
      return new Response('Session not found', { status: 404 })
    }

    if (session.merchant_id !== user.id) {
       console.warn(`[API] Unauthorised history access: user=${user.id} session_owner=${session.merchant_id}`)
      return new Response('Forbidden', { status: 403 })
    }

    // Load messages
    // loadMessages uses the service role from @project1/agent context correctly
    // or uses the provided supabase client.
    const messages = await loadMessages(sessionId, 50, supabase)
    
    return Response.json(messages)
  } catch (err: any) {
    console.error('[API] Get Messages Error:', err)
    return new Response(err.message, { status: 500 })
  }
}

