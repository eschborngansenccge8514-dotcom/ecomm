import { generateText, stepCountIs } from 'ai'
import { google } from '@ai-sdk/google'
import { buildSupportTools } from './tools'
import { buildSupportSystemPrompt } from './prompts/system'
import {
  loadSupportMessages,
  saveSupportMessages,
  touchSupportSession
} from './memory/messages'

export interface WhatsAppSupportInput {
  senderPhone: string
  messageText: string
  merchantId: string
  ownerId: string
  merchantName: string
  sessionId: string
  knowledgeBase?: string
}

/**
 * Handle an incoming WhatsApp message for the Support Agent.
 * Non-streaming for direct integration with webhooks.
 */
export async function handleWhatsAppMessage({
  senderPhone,
  messageText,
  merchantId,
  ownerId,
  merchantName,
  sessionId,
  knowledgeBase
}: WhatsAppSupportInput) {

  // 1. Load history
  let history = await loadSupportMessages(sessionId, 10)

  // 2. Build context
  const systemPrompt = buildSupportSystemPrompt(
    merchantName,
    knowledgeBase,
    `CUSTOMER PHONE: ${senderPhone}\nSESSION: WhatsApp`
  )

  // 3. Generate response
  const { text } = await generateText({
    model: google('gemini-2.5-flash-lite'), // Lean & fast
    system: systemPrompt,
    messages: [
      ...history,
      { role: 'user', content: messageText }
    ],
    tools: buildSupportTools(merchantId, ownerId, sessionId) as any,
    stopWhen: stepCountIs(10),
  })

  // 4. Side-effects (fire & forget)
  await Promise.allSettled([
    saveSupportMessages(sessionId, ownerId, [
      { role: 'user', content: messageText },
      { role: 'assistant', content: text }
    ]),
    touchSupportSession(sessionId)
  ])

  return { replyText: text }
}
