import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Load the last N messages for a support session to provide context for the AI.
 */
export async function loadSupportMessages(
  sessionId: string,
  limit = 20,
  supabase: SupabaseClient
): Promise<any[]> {
  const { data, error } = await supabase
    .from('support_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .order('sequence_number', { ascending: false })
    .limit(limit)

  if (error) {
    console.error(`[SupportAgent] Failed to load messages for session ${sessionId}:`, error)
    throw error
  }

  const rawHistory = (data ?? []).reverse().map((m: any) => {
    let content = m.content
    let toolCalls: any[] | undefined
    let toolResults: any[] | undefined

    try {
      if (content.startsWith('{') || content.startsWith('[')) {
        const parsed = JSON.parse(content)
        if (parsed && typeof parsed === 'object') {
          content = parsed.content ?? parsed.text ?? content
          toolCalls = parsed.toolCalls
          toolResults = parsed.toolResults
        }
      }
    } catch (e) {}

    return {
      role: (m.role === 'customer' ? 'user' : (m.role === 'merchant' ? 'assistant' : m.role)),
      content: content,
      ...(toolCalls ? { toolCalls } : {}),
      ...(toolResults ? { toolResults } : {})
    }
  })

  // Ultra-Resilient Merging: Strictly enforce role alternation to satisfy AI SDK schema
  const history: any[] = []
  for (const msg of rawHistory) {
    const last = history[history.length - 1]
    if (last && last.role === msg.role) {
      // Merge content
      if (typeof last.content === 'string' && typeof msg.content === 'string') {
        last.content += `\n\n${msg.content}`
      } else {
        // One or both are arrays/parts - consolidate into array
        const lastParts = Array.isArray(last.content) ? last.content : [{ type: 'text', text: last.content }]
        const nextParts = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: msg.content }]
        last.content = [...lastParts, ...nextParts]
      }
      // Consolidate metadata
      if (msg.toolCalls) last.toolCalls = [...(last.toolCalls || []), ...msg.toolCalls]
      if (msg.toolResults) last.toolResults = [...(last.toolResults || []), ...msg.toolResults]
    } else {
      history.push(msg)
    }
  }

  // --- Orphan Pruning: Reset half-finished tool turns ---
  // If the history ends in a Tool result or an Assistant tool-call without a final text response, 
  // appending a new User message will crash the AI SDK. We prune these "orphans".
  while (history.length > 0) {
    const last = history[history.length - 1]
    const isTool = last.role === 'tool'
    const isIncompleteAssistant = last.role === 'assistant' && last.toolCalls && last.toolCalls.length > 0 && !last.content

    if (isTool || isIncompleteAssistant) {
      console.log(`[SupportAgent] Pruning incomplete turn message: ${last.role}`)
      history.pop()
    } else {
      break
    }
  }

  return history
}

/**
 * Save messages from the latest turn (user + assistant) to the database.
 */
export async function saveSupportMessages(
  sessionId: string,
  merchantId: string | null,
  messages: any[],
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase.from('support_messages').insert(
    messages.map((m: any, index: number) => {
      // If the message has metadata (toolCalls, etc.), serialize the WHOLE message but keep role separate
      const hasMeta = !!(m.toolCalls || m.toolResults || Array.isArray(m.content))
      
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
  if (error) {
    console.error(`[SupportAgent] Failed to save messages for session ${sessionId}:`, error)
    throw error
  }
}

/**
 * Create a new support session for a customer.
 */
export async function createSupportSession(
  merchantId: string | null,
  supabase: SupabaseClient,
  customerEmail?: string,
  customerName?: string
): Promise<string> {
  const { data, error } = await supabase
    .from('support_sessions')
    .insert({
      merchant_id: merchantId,
      customer_email: customerEmail,
      customer_name: customerName,
      status: 'open',
      is_ai_handling: true
    })
    .select('id')
    .single()

  if (error) {
    console.error(`[SupportAgent] Failed to create session for merchant ${merchantId}:`, error)
    throw error
  }
  return data!.id as string
}

/**
 * Bump the updated_at timestamp on every turn to indicate activity.
 */
export async function touchSupportSession(sessionId: string, supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase
    .from('support_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId)
  if (error) {
    console.error(`[SupportAgent] Failed to touch session ${sessionId}:`, error)
    throw error
  }
}

/**
 * Update session details like customer info or status.
 */
export async function updateSupportSession(
  sessionId: string,
  updates: Record<string, any>,
  supabase: SupabaseClient
): Promise<void> {
  const { error } = await supabase
    .from('support_sessions')
    .update(updates)
    .eq('id', sessionId)
  if (error) {
    console.error(`[SupportAgent] Failed to update session ${sessionId}:`, error)
    throw error
  }
}
