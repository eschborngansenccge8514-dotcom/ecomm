import { createClient, SupabaseClient } from '@supabase/supabase-js'
// import type { CoreMessage } from 'ai'
type CoreMessage = any

export function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Load last N messages for a session (for context window)
export async function loadMessages(
  sessionId: string,
  limit = 20,
  supabaseInjected?: SupabaseClient
): Promise<CoreMessage[]> {
  const supabase = supabaseInjected || getSupabase()
  const { data, error } = await supabase
    .from('agent_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .order('sequence_number', { ascending: false })
    .limit(limit)

  if (error) throw error

  const rawHistory = (data ?? []).reverse().map((m: any) => {
    let content = m.content
    let toolCalls: any[] | undefined
    let toolResults: any[] | undefined

    try {
      if (content.startsWith('{') || content.startsWith('[')) {
        const parsed = JSON.parse(content)
        if (parsed && typeof parsed === 'object') {
          // AI SDK ModelMessage structure
          content = parsed.content ?? parsed.text ?? content
          toolCalls = parsed.toolCalls
          toolResults = parsed.toolResults
        }
      }
    } catch (e) {
      // Not JSON, keep as string
    }
    
    return {
      role: m.role as any,
      content: content,
      ...(toolCalls ? { toolCalls } : {}),
      ...(toolResults ? { toolResults } : {})
    }
  })

  // Ultra-Resilient Merging: Strictly enforce role alternation to satisfy AI SDK schema
  const history: CoreMessage[] = []
  for (const msg of rawHistory) {
    const last = history[history.length - 1]
    if (last && last.role === msg.role) {
      // Merge content
      if (typeof last.content === 'string' && typeof msg.content === 'string') {
        last.content += `\n\n${msg.content}`
      } else {
        // Consolidate into parts array
        const lastParts = Array.isArray(last.content) ? last.content : [{ type: 'text', text: last.content }]
        const nextParts = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: msg.content }]
        last.content = [...lastParts, ...nextParts] as any
      }
      // Consolidate metadata
      if (msg.toolCalls) last.toolCalls = [...(last.toolCalls || []), ...msg.toolCalls]
      if (msg.toolResults) last.toolResults = [...(last.toolResults || []), ...msg.toolResults]
    } else {
      history.push(msg)
    }
  }

  // --- Orphan Pruning: Reset half-finished tool turns ---
  let prunedCount = 0
  while (history.length > 0) {
    const last = history[history.length - 1]
    const isTool = last.role === 'tool'
    const isIncompleteAssistant = last.role === 'assistant' && last.toolCalls && last.toolCalls.length > 0 && !last.content

    if (isTool || isIncompleteAssistant) {
      history.pop()
      prunedCount++
    } else {
      break
    }
  }
  if (prunedCount > 0) console.log(`[MerchantAgent] Pruned ${prunedCount} incomplete turn messages`)

  return history
}

export async function saveMessages(
  sessionId: string,
  merchantId: string,
  messages: CoreMessage[],
  supabaseInjected?: SupabaseClient
): Promise<void> {
  const supabase = supabaseInjected || getSupabase()
  const { error } = await supabase.from('agent_messages').insert(
    messages.map((m, index) => {
      // Check if we need to serialize the whole message (has metadata)
      const hasMeta = !!(m.toolCalls || (m as any).toolResults || Array.isArray(m.content))

      return {
        session_id: sessionId,
        merchant_id: merchantId,
        role: m.role,
        sequence_number: index,
        content: hasMeta 
          ? JSON.stringify(m) 
          : (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
      }
    })
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
export async function touchSession(sessionId: string, supabaseInjected?: any) {
  const supabase = supabaseInjected || getSupabase()
  const { error } = await supabase
    .from('agent_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) throw error
}
