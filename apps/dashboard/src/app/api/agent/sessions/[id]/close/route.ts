import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { google }       from '@ai-sdk/google'
import { generateText } from 'ai'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const sessionId = params.id
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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
    model: google('gemini-1.5-flash'),
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
