import { createClient } from '@supabase/supabase-js'
import type { CoreMessage } from 'ai'

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Load the last N messages for a support session to provide context for the AI.
 */
export async function loadSupportMessages(
  sessionId: string,
  limit = 20
): Promise<CoreMessage[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('support_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error(`[SupportAgent] Failed to load messages for session ${sessionId}:`, error)
    throw error
  }

  return (data ?? []).map((m: any) => ({
    // DB stores 'customer'/'merchant' but CoreMessage only accepts 'user'/'assistant'
    role: (m.role === 'customer' || m.role === 'merchant' ? 'user' : m.role) as 'user' | 'assistant',
    content: m.content
  })) as CoreMessage[]
}

/**
 * Save messages from the latest turn (user + assistant) to the database.
 */
export async function saveSupportMessages(
  sessionId: string,
  merchantId: string,
  messages: CoreMessage[]
): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('support_messages').insert(
    messages.map((m: any) => ({
      session_id: sessionId,
      merchant_id: merchantId,
      role: m.role,
      content: typeof m.content === 'string'
        ? m.content
        : JSON.stringify(m.content)
    }))
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
  merchantId: string,
  customerEmail?: string,
  customerName?: string
): Promise<string> {
  const supabase = getSupabase()
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
export async function touchSupportSession(sessionId: string): Promise<void> {
  const supabase = getSupabase()
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
  updates: Record<string, any>
): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('support_sessions')
    .update(updates)
    .eq('id', sessionId)
  if (error) {
    console.error(`[SupportAgent] Failed to update session ${sessionId}:`, error)
    throw error
  }
}
