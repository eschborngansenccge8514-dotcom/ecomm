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
  instanceName?: string
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
  sessionId,
  instanceName
}: WhatsAppMerchantInput) {

  // 1. Load history
  let history = await loadMessages(sessionId, 40).catch(() => [])

  // 2. Generate response
  // Trigger Merging: Prevent consecutive user messages by merging current messageText into last history item if it's also a user
  const processedHistory = [...history]
  let mergedIntoLast = false
  if (processedHistory.length > 0 && processedHistory[processedHistory.length - 1].role === 'user') {
    const last = processedHistory[processedHistory.length - 1] as any
    last.content = typeof last.content === 'string'
      ? `${last.content}\n\n${messageText}`
      : [...(Array.isArray(last.content) ? last.content : [{ type: 'text', text: last.content }]), { type: 'text', text: messageText }]
    mergedIntoLast = true
  } else {
    processedHistory.push({ role: 'user', content: messageText } as any)
  }

  const response = await generateText({
    model: google('gemini-2.5-flash-lite'), // Use latest stable
    system: buildSystemPrompt(merchantName) + `\n\n## WhatsApp Context\nMerchant is texting from: ${senderPhone}. Respond concisely for mobile viewing.` + "\n\nIMPORTANT: You MUST always provide a helpful, professional text response. Never return an empty message.",
    messages: processedHistory,
    tools: buildTools(merchantId, sessionId, instanceName) as any,
    maxSteps: 7,
  } as any)

  // 3. Side-effects: ONLY save new messages to prevent duplication
  const fullTurnMessages = (response as any).responseMessages || []
  let replyText = response.text
  if (!replyText && fullTurnMessages.length > 0) {
    const lastAssistant = [...fullTurnMessages].reverse().find(m => m.role === 'assistant')
    if (lastAssistant) {
      replyText = typeof lastAssistant.content === 'string'
        ? lastAssistant.content
        : JSON.stringify(lastAssistant.content)
    }
  }
  const finalReplyText = replyText || "I'm sorry, I encountered an issue. I'll follow up shortly."

  const finalMessages = [...fullTurnMessages]
  if (finalMessages.length === 0 && finalReplyText) {
    console.log(`[MerchantAgent] Synthesizing assistant message for WhatsApp ${sessionId}`)
    finalMessages.push({ role: 'assistant', content: finalReplyText })
  }

  // 4. Side-effects: ONLY save new messages to prevent duplication
  const messagesToSave = [...finalMessages]
  if (!mergedIntoLast) {
    messagesToSave.unshift({ role: 'user', content: messageText })
  }

  await Promise.allSettled([
    saveMessages(sessionId, userId, messagesToSave),
    touchSession(sessionId)
  ])

  return { replyText: finalReplyText }
}
