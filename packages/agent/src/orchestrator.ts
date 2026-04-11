import { streamText, stepCountIs } from 'ai'
import { google } from '@ai-sdk/google'
import { buildTools } from './tools'
import { buildSystemPrompt } from './prompts/system'
import { saveMessages, touchSession } from './memory/messages'
import { retrieveRelevantMemories, extractAndSaveMemories } from './memory/long-term'
import { buildContextMessages } from './memory/context-manager'
import { AgentTracer } from './observability/tracer'

export interface AgentInput {
  newMessage: string
  userId: string    // For session ownership/persistence (matches FK in agent_sessions)
  merchantId: string    // For business data tools (orders, analytics)
  merchantName: string
  sessionId: string
  stream?: boolean   // Default to true
}

export async function runAgent({
  newMessage,
  userId,
  merchantId,
  merchantName,
  sessionId,
  stream = true
}: AgentInput): Promise<Response> {
  const t0 = Date.now()
  console.log(`[Agent] START session=${sessionId} msg="${newMessage.slice(0, 40)}"`)

  const tracer = new AgentTracer(userId, sessionId)

  // Step 1: build context messages
  let messages: any[]
  try {
    messages = await buildContextMessages(sessionId, merchantId, newMessage)
    console.log(`[Agent] buildContextMessages OK (${Date.now() - t0}ms) — ${messages.length} msgs`)
  } catch (e) {
    console.error(`[Agent] buildContextMessages FAILED (${Date.now() - t0}ms):`, e)
    throw e
  }

  // Step 2: retrieve memories (non-blocking — skip on failure)
  let memories: string[] = []
  try {
    const t1 = Date.now()
    memories = await retrieveRelevantMemories(merchantId, newMessage)
    console.log(`[Agent] retrieveRelevantMemories OK (${Date.now() - t1}ms) — ${memories.length} memories`)
  } catch (e) {
    console.warn(`[Agent] retrieveRelevantMemories FAILED (non-fatal):`, e)
  }

  const memoryContext = memories.length > 0
    ? `\n\n## What I know about this merchant\n${memories.map(m => `- ${m}`).join('\n')}`
    : ''

  // Track step timing and count outside streamText so they survive across callbacks
  const stepStartTimes = new Map<string, number>()
  let stepCount = 0

  // Step 3: call streamText — synchronous in ai@6, returns StreamTextResult directly
  console.log(`[Agent] calling streamText (${Date.now() - t0}ms)`)
  const result = streamText({
    model: google('gemini-3.1-flash-lite-preview'),
    system: buildSystemPrompt(merchantName) + memoryContext,
    messages,
    tools: buildTools(merchantId, sessionId) as any,
    stopWhen: stepCountIs(15),

    onStepFinish: ({ toolCalls, toolResults }: any) => {
      stepCount++

      // Record start time keyed by toolCallId so endStep can compute real duration
      toolCalls?.forEach((tc: any) => {
        stepStartTimes.set(tc.toolCallId, Date.now())
        tracer.startStep(tc.toolName)
      })

      // Results arrive in the same callback — look up the start time we just stored
      toolResults?.forEach((r: any) => {
        const started = stepStartTimes.get(r.toolCallId) ?? Date.now()
        stepStartTimes.delete(r.toolCallId)

        // instanceof Error is always false after SDK serialization — check shape instead
        const success = !r.result?.error
        tracer.endStep(
          r.toolName,
          Date.now() - started,
          success,
          success ? undefined : String(r.result?.error)
        )
      })
    },

    onFinish: async ({ text, usage, finishReason }) => {
      // ai@6 uses inputTokens/outputTokens (was promptTokens/completionTokens in v3)
      const u = usage as any
      const inputTok = u.inputTokens ?? u.promptTokens ?? 0
      const outputTok = u.outputTokens ?? u.completionTokens ?? 0
      console.log(`[Agent] onFinish — reason=${finishReason} textLen=${text.length} tokens=${inputTok}/${outputTok}`)

      // Run all side-effects in parallel — none depend on each other
      const labels = ['saveMessages', 'touchSession', 'extractAndSaveMemories', 'tracer.flush']
      const results = await Promise.allSettled([
        saveMessages(sessionId, userId, [
          { role: 'user', content: newMessage },
          { role: 'assistant', content: text }
        ]),
        touchSession(sessionId),
        extractAndSaveMemories(merchantId, newMessage, text),
        tracer.flush({
          promptTokens: inputTok,
          completionTokens: outputTok,
          steps: stepCount,
          status: finishReason === 'error' ? 'failed' : 'completed'
        })
      ])

      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.error(`[Agent] ${labels[i]} FAILED:`, r.reason)
        } else {
          console.log(`[Agent] ${labels[i]} OK`)
        }
      })

      console.log(`[Agent] DONE total=${Date.now() - t0}ms`)
    }
  })

  // ai@6: return standard UI message stream protocol OR wait and return full JSON (for mobile/non-streaming)
  if (stream) {
    return result.toUIMessageStreamResponse()
  } else {
    // Wait for the stream to complete and return a standard JSON object
    const text = await result.text
    return new Response(JSON.stringify({ text, sessionId }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
