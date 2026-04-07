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
  supabase: any // Injected Supabase client
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
  knowledgeBase,
  supabase
}: WhatsAppSupportInput) {

  // 1. Load history
  let history = await loadSupportMessages(sessionId, 40, supabase)

  // 2. Build context
  const systemPrompt = buildSupportSystemPrompt(
    merchantName,
    knowledgeBase,
    `CUSTOMER PHONE: ${senderPhone}\nSESSION: WhatsApp`
  )

  // 3. Generate response
  // Trigger Merging: Prevent consecutive user messages by merging current messageText into last history item if it's also a user
  const processedHistory = [...history]
  let mergedIntoLast = false
  if (processedHistory.length > 0 && processedHistory[processedHistory.length - 1].role === 'user') {
    const last = processedHistory[processedHistory.length - 1]
    last.content = typeof last.content === 'string'
      ? `${last.content}\n\n${messageText}`
      : [...(Array.isArray(last.content) ? last.content : [{ type: 'text', text: last.content }]), { type: 'text', text: messageText }]
    mergedIntoLast = true
  } else {
    processedHistory.push({ role: 'user', content: messageText })
  }

  const response = await generateText({
    model: google('gemini-2.5-flash-lite'), // Use latest stable
    system: systemPrompt + "\n\nIMPORTANT: You MUST always provide a helpful, professional text response. Never return an empty message.",
    messages: processedHistory,
    tools: buildSupportTools(merchantId, ownerId, sessionId, supabase) as any,
    maxSteps: 7,
  } as any)

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

  // 4. Side-effects: ONLY save new messages to prevent duplication
  const finalMessages = [...fullTurnMessages]
  if (finalMessages.length === 0 && finalReplyText) {
    console.log(`[SupportAgent] Synthesizing assistant message for WhatsApp ${sessionId}`)
    finalMessages.push({ role: 'assistant', content: finalReplyText })
  }

  const messagesToSave = [...finalMessages]
  if (!mergedIntoLast) {
    messagesToSave.unshift({ role: 'user', content: messageText })
  }

  await Promise.allSettled([
    saveSupportMessages(sessionId, ownerId, messagesToSave, supabase),
    touchSupportSession(sessionId, supabase)
  ])

  return { replyText: finalReplyText }
}
