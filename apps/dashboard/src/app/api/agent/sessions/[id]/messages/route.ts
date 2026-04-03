import { getAuthContext } from '@/lib/utils.server'
import { loadMessages } from '@project1/agent'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params
  console.log(`[API] Fetching messages for session: ${sessionId}`)
  
  const { supabase, user, merchant, isAdmin } = await getAuthContext()
  if (!user || (!merchant && !isAdmin)) return new Response('Unauthorized', { status: 401 })

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
