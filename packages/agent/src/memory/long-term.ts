import { createClient } from '@supabase/supabase-js'
import { google } from '@ai-sdk/google'
import { embed, generateText } from 'ai'

function getAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function saveLongTermMemory(
  merchantId: string,
  content: string,
  type: 'fact' | 'preference' | 'pattern'
) {
  const admin = getAdmin()
  const { embedding } = await embed({
    model: google.embeddingModel('gemini-embedding-001'),
    value: content
  })
  await admin.from('agent_memory').insert({ merchant_id: merchantId, type, content, embedding })
}

// NEW: Retrieve relevant memories for a given query
export async function retrieveRelevantMemories(
  merchantId: string,
  query: string,
  limit: number = 5
): Promise<string[]> {
  const admin = getAdmin()

  const { embedding } = await embed({
    model: google.embeddingModel('gemini-embedding-001'),
    value: query
  })

  const { data } = await admin.rpc('match_agent_memory', {
    query_embedding: embedding,
    merchant_id_arg: merchantId,
    match_count: limit
  })

  return (data ?? [])
    .filter((m: any) => m.similarity > 0.75)  // only high-confidence matches
    .map((m: any) => m.content)
}

// NEW: Extract memories from a turn and save them
export async function extractAndSaveMemories(
  merchantId: string,
  userMessage: string,
  assistantReply: string
) {
  const { text } = await generateText({
    model: google('gemini-3.1-flash-lite-preview'),
    prompt: `Extract any specific merchant preferences, reusable patterns, or key business facts from this turn.
If nothing new or specific is found, return "NONE".
Format each finding as a short bullet point.

USER: ${userMessage}
ASSISTANT: ${assistantReply}

Findings:`
  })

  if (text.includes('NONE')) return

  const memories = text
    .split('\n')
    .map(line => line.replace(/^- /, '').trim())
    .filter(line => line.length > 5)

  for (const m of memories) {
    await saveLongTermMemory(merchantId, m, 'fact')
  }
}
