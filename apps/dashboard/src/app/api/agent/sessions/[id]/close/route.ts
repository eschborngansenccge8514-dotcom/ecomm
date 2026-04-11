import { getAuthContext } from '@/lib/utils.server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params

  const { user, merchant, isAdmin } = await getAuthContext()
  if (!user || (!merchant && !isAdmin)) return new Response('Unauthorized', { status: 401 })

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Verify ownership before processing
  const { data: session } = await supabase
    .from('agent_sessions')
    .select('merchant_id')
    .eq('id', sessionId)
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (session.merchant_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 1. Fetch all messages for this session
  const { data: messages } = await supabase
    .from('agent_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (!messages || messages.length === 0) {
    return NextResponse.json({ success: true })
  }

  // 2. Generate summary using Gemini
  const chatTranscript = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n')

  const { text: summary } = await generateText({
    model: google('gemini-3.1-flash-lite-preview'),
    prompt: `Summarize this agent-merchant conversation into a concise 1-2 sentence overview of what was discussed and any actions taken.
    
    TRANSCRIPT:
    ${chatTranscript}
    
    SUMMARY:`
  })

  // 3. Update session with summary and mark inactive
  await supabase
    .from('agent_sessions')
    .update({
      summary,
      is_active: false,
      closed_at: new Date().toISOString()
    })
    .eq('id', sessionId)

  return NextResponse.json({ success: true, summary })
}
