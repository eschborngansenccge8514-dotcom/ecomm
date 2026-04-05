import { createClient } from '@supabase/supabase-js'
// import type { CoreMessage } from 'ai'
type CoreMessage = any

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Load last N messages for a session (for context window)
export async function loadMessages(
  sessionId: string,
  limit = 20
): Promise<CoreMessage[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('agent_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) throw error

  return (data ?? []).map(m => ({
    role: m.role as any,
    content: m.content
  })) as CoreMessage[]
}

// Save a batch of new messages after a turn
export async function saveMessages(
  sessionId:  string,
  merchantId: string,
  messages:   CoreMessage[]
): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('agent_messages').insert(
    messages.map(m => ({
      session_id:  sessionId,
      merchant_id: merchantId,
      role:        m.role,
      content:     typeof m.content === 'string'
                     ? m.content
                     : JSON.stringify(m.content)
    }))
  )
  if (error) throw error
}

// Create a new session and return its ID
export async function createSession(merchantId: string, firstMessage: string) {
  const supabase = getSupabase()
  // Auto-title: first 60 chars of first user message
  const title = firstMessage.slice(0, 60) + (firstMessage.length > 60 ? '…' : '')
  const { data, error } = await supabase
    .from('agent_sessions')
    .insert({ merchant_id: merchantId, title })
    .select('id')
    .single()
  
  if (error) throw error
  return data!.id as string
}

// Bump updated_at on every turn
export async function touchSession(sessionId: string) {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('agent_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) throw error
}
