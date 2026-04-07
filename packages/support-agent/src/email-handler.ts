import { generateText, stepCountIs } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { buildSupportTools } from './tools'
import { buildSupportSystemPrompt } from './prompts/system'
import {
  loadSupportMessages,
  saveSupportMessages,
  touchSupportSession
} from './memory/messages'

export interface SupportEmailHandlerInput {
  from: string
  subject: string
  body: string
  merchantId: string | null // The Merchant UUID or Owner ID
  sessionId: string
  merchantName: string
  ownerId: string | null
  attachments?: Array<{ filename: string; contentType: string }>
  supabase: any // Injected Supabase client
  googleApiKey: string // Injected AI API Key
  logId?: string // Optional: ID of the email_logs record to update
}

/**
 * Handle an incoming email for the Support Agent.
 * Uses generateText (non-streaming) for direct reply sending.
 */
export async function handleSupportEmailInput({
  from,
  subject,
  body,
  merchantId,
  sessionId,
  merchantName,
  ownerId,
  attachments = [],
  supabase,
  googleApiKey,
  logId
}: SupportEmailHandlerInput) {

  const google = createGoogleGenerativeAI({
    apiKey: googleApiKey
  })

  // 1. Fetch support config and customer context
  try {
    console.log(`[SupportAgent] Fetching config and history for ${sessionId}...`)
    // 1.1 Update log that we are starting internal processing
    if (logId) {
      await supabase.from('email_logs').update({
        status: 'processing',
        metadata: { step: 'handler-internal-start', sessionId }
      }).eq('id', logId)
    }

    const [configRes, history] = await Promise.all([
      supabase
        .from('support_configs')
        .select('ai_enabled, knowledge_base_text')
        .eq('merchant_id', ownerId)
        .maybeSingle(),
      loadSupportMessages(sessionId, 20, supabase).catch(() => [])
    ])

    if (logId) {
      await supabase.from('email_logs').update({
        metadata: { step: 'handler-data-loaded', sessionId, hasConfig: !!configRes.data, historyCount: history.length }
      }).eq('id', logId)
    }

    const ai_enabled = configRes.data?.ai_enabled ?? true
    const knowledge_base_text = configRes.data?.knowledge_base_text ?? null

    if (!ai_enabled) {
      return { replyText: null, error: 'AI is disabled for support' }
    }

    let attachmentContext = ""
    if (attachments.length > 0) {
      attachmentContext = `\n\n## Attachments\nThe user attached the following files:\n${attachments.map(a => `- ${a.filename} (${a.contentType})`).join('\n')}`
    }

    const systemPrompt = buildSupportSystemPrompt(merchantName, knowledge_base_text, `\nCUSTOMER: ${from}`) +
      `\n\n## Email Context\nFrom: ${from}\nSubject: ${subject}${attachmentContext}\n\n` +
      `You are replying to an inbound support email. Please follow these guidelines:\n` +
      `1. Be professional, empathetic, and efficient.\n` +
      `2. Address the customer's issues directly using available tools.\n` +
      `3. Do NOT include a subject line in your output; only provide the email body.\n` +
      `4. Sign off as "${merchantName} Support".`

    // 2. Generate response
    console.log(`[SupportAgent] Calling AI for session ${sessionId} (Merchant: ${merchantName})`)

    // Trigger Merging: Prevent consecutive user messages by merging current body into last history item if it's also a user
    const processedHistory = [...history]
    let mergedIntoLast = false
    if (processedHistory.length > 0 && processedHistory[processedHistory.length - 1].role === 'user') {
      const last = processedHistory[processedHistory.length - 1]
      last.content = typeof last.content === 'string'
        ? `${last.content}\n\n${body}`
        : [...(Array.isArray(last.content) ? last.content : [{ type: 'text', text: last.content }]), { type: 'text', text: body }]
      mergedIntoLast = true
    } else {
      processedHistory.push({ role: 'user', content: body })
    }

    let response: any
    try {
      response = await generateText({
        model: google('gemini-2.5-flash-lite'),
        system: systemPrompt + "\n\nIMPORTANT: You MUST always provide a helpful, professional text response. Never return an empty message.",
        messages: processedHistory,
        tools: buildSupportTools(merchantId, ownerId, sessionId, supabase) as any,
        maxSteps: 7, // Increased for complex order lookups
      } as any)
      console.log(`[SupportAgent] AI response received for ${sessionId}. Text length: ${response.text?.length || 0}`)

      if (logId) {
        await supabase.from('email_logs').update({
          metadata: { step: 'handler-ai-complete', textLength: response.text?.length || 0, finishReason: response.finishReason }
        }).eq('id', logId)
      }
    } catch (err: any) {
      console.error(`[SupportAgent] AI generation failed for ${sessionId}:`, err.message)
      if (logId) {
        await supabase.from('email_logs').update({
          status: 'error',
          error: `AI Generation Error: ${err.message}`,
          metadata: { step: 'handler-ai-error', sessionId }
        }).eq('id', logId)
      }
      throw err
    }

    const fullTurnMessages = (response as any).responseMessages || []
    let replyText = response.text
    if (!replyText && fullTurnMessages.length > 0) {
      // Fallback: If text is empty but we have messages, take the content of the last assistant message
      const lastAssistant = [...fullTurnMessages].reverse().find(m => m.role === 'assistant')
      if (lastAssistant) {
        replyText = typeof lastAssistant.content === 'string'
          ? lastAssistant.content
          : JSON.stringify(lastAssistant.content)
      }
    }
    const finalReplyText = replyText || "I'm sorry, I'm currently processing multiple inquiries and reached a temporary limit. I'll follow up properly in a few minutes."

    // 3. Persistence: Force Syncing History
    // Create a synthesized assistant message if the turn returned no messages but we have a reply
    const finalMessages = [...fullTurnMessages]
    if (finalMessages.length === 0 && finalReplyText) {
      console.log(`[SupportAgent] Synthesizing assistant message for session ${sessionId} (Empty turn messages but found reply text)`)
      finalMessages.push({ role: 'assistant', content: finalReplyText })
    }

    // To prevent duplication, we ONLY save the NEW messages (Assistant / Tool) from the responseMessages.
    // If we DID NOT merge the inbound message into the last history item, we also save that one new 'user' message.
    const messagesToSave = [...finalMessages]
    if (!mergedIntoLast) {
      messagesToSave.unshift({ role: 'user', content: body })
    }

    await Promise.allSettled([
      saveSupportMessages(sessionId, ownerId, messagesToSave, supabase),
      touchSupportSession(sessionId, supabase)
    ])

    return { replyText: finalReplyText }
  } catch (err: any) {
    console.error(`[SupportAgent] Internal handler failure for ${sessionId}:`, err.message)
    if (logId) {
      await supabase.from('email_logs').update({
        status: 'error',
        error: err.message,
        metadata: { step: 'handler-critical-error', sessionId, stack: err.stack }
      }).eq('id', logId)
    }
    throw err
  }
}
