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

  // 1. Load history and resolve customer context
  const [history, profile] = await Promise.all([
    loadSupportMessages(sessionId, 40, supabase),
    supabase
      .from('profiles')
      .select('id')
      .eq('phone', senderPhone)
      .maybeSingle()
  ])

  const customerId = profile?.data?.id

  // 2. Build context
  const systemPrompt = buildSupportSystemPrompt(
    merchantName,
    knowledgeBase,
    `CUSTOMER PHONE: ${senderPhone}${customerId ? ` (ID: ${customerId})` : ''}\nSESSION: WhatsApp`
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
    model: google('gemini-3.1-flash-lite-preview'), // Use latest stable
    system: systemPrompt + "\n\nIMPORTANT: You MUST always provide a helpful, professional text response. Never return an empty message.",
    messages: processedHistory,
    tools: buildSupportTools(merchantId, ownerId, sessionId, supabase, customerId) as any,
    maxSteps: 10,
  } as any)

  const resultMessages = (response as any).responseMessages || (response as any).messages || []
  let replyText = response.text
  if (!replyText && resultMessages.length > 0) {
    const lastAssistant = [...resultMessages].reverse().find((m: any) => m.role === 'assistant')
    if (lastAssistant) {
      if (typeof lastAssistant.content === 'string') {
        replyText = lastAssistant.content
      } else if (Array.isArray(lastAssistant.content)) {
        const textPart = lastAssistant.content.find((p: any) => p.type === 'text' || p.text)
        replyText = typeof textPart === 'string' ? textPart : (textPart?.text || "")
      }
    }
  }
  const finalReplyText = replyText || "I'm sorry, I encountered an issue. I'll follow up shortly."

  // 4. Side-effects: ONLY save new messages to prevent duplication
  const finalMessages = [...resultMessages]
  if (finalMessages.length === 0 && finalReplyText) {
    console.log(`[SupportAgent] Synthesizing assistant message for WhatsApp ${sessionId}`)
    finalMessages.push({ role: 'assistant', content: finalReplyText })
  }

  const messagesToSave = [...finalMessages]
  if (!mergedIntoLast) {
    messagesToSave.unshift({ role: 'user', content: messageText } as any)
  }

  await Promise.allSettled([
    saveSupportMessages(sessionId, ownerId, messagesToSave, supabase),
    touchSupportSession(sessionId, supabase)
  ])

  return { replyText: finalReplyText }
}
