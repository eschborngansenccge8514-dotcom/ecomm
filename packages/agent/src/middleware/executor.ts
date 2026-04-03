import { createClient } from '@supabase/supabase-js'

export type RiskLevel = 'low' | 'medium' | 'high'

export interface ToolMeta {
  riskLevel: RiskLevel
  approvalTitle?:       (input: any) => string
  approvalDescription?: (input: any) => string
}

export class AwaitingApprovalError extends Error {
  constructor(
    public approvalId: string,
    public actionId:   string,
    public title:      string
  ) {
    super(`Awaiting merchant approval: ${title}`)
    this.name = 'AwaitingApprovalError'
  }
}

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function executeWithGuard<T>(
  toolName:   string,
  input:      unknown,
  meta:       ToolMeta,
  merchantId: string,
  sessionId:  string,
  fn:         () => Promise<T>
): Promise<T> {
  const supabase = getSupabase()

  // Log action
  const { data: action, error: actionError } = await supabase
    .from('agent_actions')
    .insert({
      session_id:  sessionId,
      merchant_id: merchantId,
      tool_name:   toolName,
      input,
      risk_level:  meta.riskLevel,
      status:      meta.riskLevel === 'high' ? 'pending_approval' : 'executed'
    })
    .select()
    .single()

  if (actionError) throw actionError

  // High risk → write to approval queue and halt
  if (meta.riskLevel === 'high') {
    const title = meta.approvalTitle?.(input) ?? toolName
    const description = meta.approvalDescription?.(input) ?? JSON.stringify(input)

    const { data: approval, error: approvalError } = await supabase
      .from('agent_approvals')
      .insert({
        action_id:   action.id,
        merchant_id: merchantId,
        risk_level:  'high',
        title,
        description,
        tool_name:   toolName,
        tool_input:  input
      })
      .select()
      .single()

    if (approvalError) throw approvalError

    throw new AwaitingApprovalError(approval.id, action.id, title)
  }

  // Low / medium → execute and record result
  try {
    const result = await fn()
    await supabase
      .from('agent_actions')
      .update({ output: result as any, status: 'executed' })
      .eq('id', action.id)
    return result
  } catch (err) {
    await supabase
      .from('agent_actions')
      .update({ status: 'failed', output: { error: String(err) } as any })
      .eq('id', action.id)
    throw err
  }
}
export interface FallbackConfig {
  maxRetries:    number
  retryDelayMs:  number
  fallbackValue?: unknown   // return this if all retries fail instead of throwing
}

export async function withRetry<T>(
  fn:       () => Promise<T>,
  config:   FallbackConfig = { maxRetries: 2, retryDelayMs: 1000 }
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err

      // Don't retry on 4xx — these are caller errors, not transient
      if (err instanceof Response && err.status >= 400 && err.status < 500) throw err

      if (attempt < config.maxRetries) {
        await new Promise(r => setTimeout(r, config.retryDelayMs * (attempt + 1)))
      }
    }
  }

  // All retries exhausted
  if (config.fallbackValue !== undefined) return config.fallbackValue as T
  throw lastError
}
