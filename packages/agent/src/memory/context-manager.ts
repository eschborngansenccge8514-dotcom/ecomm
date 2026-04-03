import { generateText }   from 'ai'
import { google }         from '@ai-sdk/google'
import { createClient }   from '@supabase/supabase-js'
import type { CoreMessage } from 'ai'

// Rough token estimator — 1 token ≈ 4 characters for English
function estimateTokens(messages: CoreMessage[]): number {
  return messages.reduce((sum, m) => {
    const content = typeof m.content === 'string'
      ? m.content
      : JSON.stringify(m.content)
    return sum + Math.ceil(content.length / 4)
  }, 0)
}

const MAX_HISTORY_TOKENS = 12_000   // ~48K chars — leaves headroom for system + tools
const SUMMARY_THRESHOLD  = 10_000   // start summarising when we approach limit

export async function buildContextMessages(
  sessionId:  string,
  merchantId: string,
  newMessage: string
): Promise<CoreMessage[]> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Load the last 40 messages (generous window)
  const { data: rows } = await supabase
    .from('agent_messages')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(40)

  const history: CoreMessage[] = (rows ?? []).map(r => ({
    role:    r.role as 'user' | 'assistant',
    content: r.content
  }))

  const estimated = estimateTokens(history)

  // Under threshold — use as-is
  if (estimated < SUMMARY_THRESHOLD) {
    return [...history, { role: 'user', content: newMessage }]
  }

  // Over threshold — summarise the oldest half, keep recent messages verbatim
  const mid       = Math.floor(history.length / 2)
  const oldHalf   = history.slice(0, mid)
  const recentHalf = history.slice(mid)

  const { text: compressionSummary } = await generateText({
    model:  google('gemini-2.0-flash'),
    prompt: `Summarise this conversation history as a compact context block.
Focus on: decisions made, key facts established, actions completed, anything pending.
Maximum 200 words. Write in third person ("The merchant asked...", "The agent confirmed...").

${oldHalf.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}`
  })

  // Inject summary as a system-style user message at the start
  const compressed: CoreMessage[] = [
    { role: 'user',      content: `[CONTEXT SUMMARY]\n${compressionSummary}` },
    { role: 'assistant', content: 'Understood. I have the context from earlier in our conversation.' },
    ...recentHalf,
    { role: 'user', content: newMessage }
  ]

  // Save the compression event so we don't re-summarise old messages again
  await supabase.from('agent_sessions').update({
    summary:    compressionSummary,
    updated_at: new Date().toISOString()
  }).eq('id', sessionId)

  return compressed
}
