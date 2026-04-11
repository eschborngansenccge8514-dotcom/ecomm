import { generateText, stepCountIs } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { buildTools } from './tools'
import { buildSystemPrompt } from './prompts/system'
import {
  loadMessages,
  saveMessages,
  touchSession
} from './memory/messages'

export interface EmailHandlerInput {
  from: string
  subject: string
  body: string
  merchantId: string // The Merchant UUID
  ownerId: string    // The User UUID (for session auth)
  merchantName: string
  sessionId: string
  attachments?: Array<{ filename: string; contentType: string }>
  supabase: any // Injected Supabase client
  googleApiKey: string // Injected AI API Key
  logId?: string // Optional: ID of the email_logs record to update
}

/**
 * Handle an incoming email for the Merchant Agent.
 * Uses generateText (non-streaming) for direct reply sending.
 */
export async function handleEmailInput({
  from,
  subject,
  body,
  merchantId,
  ownerId,
  merchantName,
  sessionId,
  attachments = [],
  supabase,
  googleApiKey,
  logId
}: EmailHandlerInput) {

  const google = createGoogleGenerativeAI({
    apiKey: googleApiKey
  })

  // 1. Load history
  if (logId) {
    await supabase.from('email_logs').update({
      status: 'processing',
      metadata: { step: 'handler-internal-start', sessionId }
    }).eq('id', logId)
  }
  let history = await loadMessages(sessionId, 20, supabase).catch(() => [])

  let attachmentContext = ""
  if (attachments.length > 0) {
    attachmentContext = `\n\n## Attachments\nThe customer attached the following files:\n${attachments.map(a => `- ${a.filename} (${a.contentType})`).join('\n')}`
  }

  const systemPrompt = buildSystemPrompt(merchantName) +
    `\n\n## Email Context\nFrom: ${from}\nSubject: ${subject}${attachmentContext}\n\n` +
    `You are replying to an inbound email inquiry. Please follow these guidelines:\n` +
    `1. Be professional, concise, and helpful.\n` +
    `2. Address the customer's concerns directly.\n` +
    `3. Use any available tools to look up relevant information (orders, etc.) if needed.\n` +
    `4. Do NOT include a subject line in your output; only provide the email body.\n` +
    `5. Sign off as "${merchantName} Assistant".`


  // 2. Generate response with multi-step tool support
  console.log(`[MerchantAgent] Calling AI for session ${sessionId} (Merchant: ${merchantName})`)

  // Trigger Merging: Prevent consecutive user messages by merging current body into last history item if it's also a user
  const processedHistory = [...history]
  let mergedIntoLast = false
  if (processedHistory.length > 0 && processedHistory[processedHistory.length - 1].role === 'user') {
    const last = processedHistory[processedHistory.length - 1] as any
    last.content = typeof last.content === 'string'
      ? `${last.content}\n\n${body}`
      : [...(Array.isArray(last.content) ? last.content : [{ type: 'text', text: last.content }]), { type: 'text', text: body }]
    mergedIntoLast = true
  } else {
    processedHistory.push({ role: 'user', content: body } as any)
  }

  let response: any
  try {
    response = await generateText({
      model: google('gemini-3.1-flash-lite-preview'), // Use latest stable
      system: systemPrompt + "\n\nIMPORTANT: You MUST always provide a helpful, professional text response. Never return an empty message.",
      messages: processedHistory,
      tools: (() => {
        const { send_email, whatsapp_send_text, whatsapp_check_number, ...rest } = buildTools(merchantId, sessionId)
        return rest
      })() as any,
      maxSteps: 7,
    } as any)
    console.log(`[MerchantAgent] AI response received for ${sessionId}. Text length: ${response.text?.length || 0}`)

    if (logId) {
      await supabase.from('email_logs').update({
        metadata: { step: 'handler-ai-complete', textLength: response.text?.length || 0, finishReason: response.finishReason }
      }).eq('id', logId)
    }
  } catch (err: any) {
    console.error(`[MerchantAgent] AI generation failed for ${sessionId}:`, err.message)
    if (logId) {
      await supabase.from('email_logs').update({
        status: 'error',
        error: `AI Generation Error: ${err.message}`,
        metadata: { step: 'handler-ai-error', sessionId }
      }).eq('id', logId)
    }
    throw err
  }

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
    console.log(`[MerchantAgent] Synthesizing assistant message for session ${sessionId}`)
    finalMessages.push({ role: 'assistant', content: finalReplyText })
  }

  // If we merged, we don't save the user message because it's already in the DB as the previous row.
  const messagesToSave = [...finalMessages]
  if (!mergedIntoLast) {
    messagesToSave.unshift({ role: 'user', content: body })
  }

  await Promise.allSettled([
    saveMessages(sessionId, ownerId, messagesToSave, supabase),
    touchSession(sessionId, supabase)
  ])

  return { replyText: finalReplyText }
}

