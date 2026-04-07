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

  // Log action — best-effort for low/medium risk so a missing table never
  // blocks a tool call. High risk still requires the row (needed for approval ID).
  let actionId: string | null = null
  try {
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

    if (actionError) {
      if (meta.riskLevel === 'high') throw actionError
      console.warn(`[executor] Failed to log action for ${toolName}:`, actionError.message)
    } else {
      actionId = action?.id ?? null
    }
  } catch (err) {
    if (meta.riskLevel === 'high') throw err
    console.warn(`[executor] Action logging exception for ${toolName}:`, err)
  }

  // High risk → formerly wrote to approval queue and halted.
  // Now we just log and proceed (Human-in-the-loop will be handled via conversation).
  if (meta.riskLevel === 'high') {
    const title = meta.approvalTitle?.(input) ?? toolName
    const description = meta.approvalDescription?.(input) ?? JSON.stringify(input)

    const { data: approval, error: approvalError } = await supabase
      .from('agent_approvals')
      .insert({
        action_id:   actionId,
        merchant_id: merchantId,
        risk_level:  'high',
        title,
        description,
        tool_name:   toolName,
        tool_input:  input,
        status:      'approved' // Mark as automatically approved for now
      })
      .select()
      .single()

    if (approvalError) console.warn(`[executor] Failed to log approval record:`, approvalError.message)
    
    // NEW: Notify merchant of high-risk action
    try {
      const { informMerchantViaWhatsApp } = await import('../utils/whatsapp-notifier')
      await informMerchantViaWhatsApp(
        merchantId,
        `⚠️ *Agent Alert: High-Risk Action*\n\nYour agent is performing a high-risk task.\n\n*Action*: ${title}\n*Details*: ${description.slice(0, 50)}${description.length > 50 ? '...' : ''}\n\nThis action was automatically logged for your review.`
      )
    } catch (e) {
      console.warn(`[executor] Notification failed:`, e)
    }

    // IMPORTANT: We used to throw AwaitingApprovalError here. 
    // Now we continue to the execution block below.
  }

  // Low / medium → execute and record result
  try {
    const result = await fn()
    if (actionId) {
      await supabase
        .from('agent_actions')
        .update({ output: result as any, status: 'executed' })
        .eq('id', actionId)
    }
    return result
  } catch (err) {
    if (actionId) {
      await supabase
        .from('agent_actions')
        .update({ status: 'failed', output: { error: String(err) } as any })
        .eq('id', actionId)
    }

    // NEW: Notify merchant of tool failure
    try {
      const { informMerchantViaWhatsApp } = await import('../utils/whatsapp-notifier')
      await informMerchantViaWhatsApp(
        merchantId,
        `❌ *Agent Alert: Tool Failure*\n\nThe agent encountered an issue while running *${toolName}*.\n\n*Error*: ${String(err).slice(0, 100)}${String(err).length > 100 ? '...' : ''}\n\nThe agent will attempt to recover or report the error to the user.`
      )
    } catch (e) {
      console.warn(`[executor] Error notification failed:`, e)
    }

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
