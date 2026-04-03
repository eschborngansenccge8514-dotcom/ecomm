import { createClient } from '@supabase/supabase-js'

// Gemini 2.5 Flash pricing (as of 2026 — update when pricing changes)
const COST_PER_1K_INPUT  = 0.000075   // $0.075 per 1M input tokens
const COST_PER_1K_OUTPUT = 0.0003     // $0.300 per 1M output tokens

function getAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface StepTrace {
  tool:        string
  latency_ms:  number
  success:     boolean
  error?:      string
}

export class AgentTracer {
  private startTime:   number
  private stepTraces:  StepTrace[] = []
  private stepStart:   number = 0

  constructor(
    private merchantId: string,
    private sessionId:  string,
    private model:      string = 'gemini-2.5-flash',
    private runType:    string = 'chat'
  ) {
    this.startTime = Date.now()
  }

  startStep(toolName: string) {
    this.stepStart = Date.now()
    return toolName
  }

  endStep(toolName: string, manualLatency: number, success: boolean, error?: string) {
    this.stepTraces.push({
      tool:       toolName,
      latency_ms: manualLatency,
      success,
      error
    })
  }

  async flush(opts: {
    promptTokens:     number
    completionTokens: number
    steps:            number
    status:           'completed' | 'failed' | 'aborted'
    error?:           string
  }) {
    const totalTokens = opts.promptTokens + opts.completionTokens
    const estimatedCostUsd =
      (opts.promptTokens     / 1000) * COST_PER_1K_INPUT +
      (opts.completionTokens / 1000) * COST_PER_1K_OUTPUT

    const admin = getAdmin()
    await admin.from('agent_traces').insert({
      merchant_id:       this.merchantId,
      session_id:        this.sessionId,
      run_type:          this.runType,
      model:             this.model,
      prompt_tokens:     opts.promptTokens,
      completion_tokens: opts.completionTokens,
      total_tokens:      totalTokens,
      estimated_cost_usd: estimatedCostUsd,
      steps:             opts.steps,
      tool_calls:        this.stepTraces,
      duration_ms:       Date.now() - this.startTime,
      status:            opts.status,
      error:             opts.error ?? null
    })
  }
}
