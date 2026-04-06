import { generateText, stepCountIs } from 'ai'
import { google } from '@ai-sdk/google'
import { buildTools } from './tools'
import { buildSystemPrompt } from './prompts/system'

export interface EmailHandlerInput {
  from: string
  subject: string
  body: string
  merchantId: string
  merchantName: string
  sessionId: string
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
  merchantName,
  sessionId
}: EmailHandlerInput) {

  const systemPrompt = buildSystemPrompt(merchantName) +
    `\n\n## Email Context\nFrom: ${from}\nSubject: ${subject}\n\nThis is an inbound email. Please reply professionally and concisely as the Merchant Assistant.`

  const { text } = await generateText({
    model: google('gemini-2.5-flash-lite'), // Using flash for fast email replies
    system: systemPrompt,
    prompt: body,
    tools: buildTools(merchantId, sessionId) as any,
    maxSteps: 10,
    stopWhen: stepCountIs(10),
  })

  return { replyText: text }
}
