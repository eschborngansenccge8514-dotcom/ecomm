import { generateText, stepCountIs } from 'ai'
import { google } from '@ai-sdk/google'
import { buildTools } from './tools'
import { buildSystemPrompt } from './prompts/system'
import {
  loadMessages,
  saveMessages,
  touchSession
} from './memory/messages'

export interface WhatsAppMerchantInput {
  senderPhone: string
  messageText: string
  merchantId: string
  userId: string
  merchantName: string
  sessionId: string
}

/**
 * Handle an incoming WhatsApp message for the Merchant Agent (Merchant texting AI).
 * Non-streaming for direct integration with webhooks.
 */
export async function handleMerchantWhatsApp({
  senderPhone,
  messageText,
  merchantId,
  userId,
  merchantName,
  sessionId
}: WhatsAppMerchantInput) {

  // 1. Load history
  let history = await loadMessages(sessionId, 10).catch(() => [])

  // 2. Generate response
  const { text } = await generateText({
    model: google('gemini-2.5-flash-lite'), // Lean & fast
    system: buildSystemPrompt(merchantName) + `\n\n## WhatsApp Context\nMerchant is texting from: ${senderPhone}. Respond concisely for mobile viewing.`,
    messages: [
      ...history,
      { role: 'user', content: messageText }
    ],
    tools: buildTools(merchantId, sessionId) as any,
    stopWhen: stepCountIs(10),
  })

  // 3. Side-effects
  await Promise.allSettled([
    saveMessages(sessionId, userId, [
      { role: 'user', content: messageText },
      { role: 'assistant', content: text }
    ]),
    touchSession(sessionId)
  ])

  return { replyText: text }
}
