import { tool } from 'ai'
import { z } from 'zod'
import { executeWithGuard } from '../middleware/executor'
import { createClient }     from '@supabase/supabase-js'

function edgeCall(path: string, body: object) {
  return fetch(`${process.env.SUPABASE_URL}/functions/v1/${path}`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify(body)
  }).then(r => r.json())
}

// Tool 1: Save a playbook — low risk
export const savePlaybook = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Save a reusable multi-step workflow as a named playbook. The agent will execute this playbook on demand or on a schedule. Use this when the merchant wants to automate a recurring task.',
    parameters: z.object({
      name:        z.string().describe('Short descriptive name e.g. "Morning order briefing" or "End-of-day invoice sweep"'),
      description: z.string().describe('What this playbook does in plain language'),
      steps:       z.array(z.string()).min(1).max(10)
                   .describe('Ordered list of instructions — each step is a plain-English instruction the agent will execute'),
      schedule:    z.object({
        type:     z.enum(['manual', 'daily', 'weekly', 'monthly']),
        time:     z.string().optional().describe('24h time in Asia/Kuala_Lumpur e.g. "08:00"'),
        day:      z.number().min(0).max(6).optional().describe('Day of week 0=Sun for weekly schedules'),
        day_of_month: z.number().min(1).max(28).optional().describe('Day of month for monthly schedules')
      })
    }),
    execute: async (input: any) => {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data } = await supabase
        .from('agent_playbooks')
        .upsert({
          merchant_id: merchantId,
          name:        input.name,
          description: input.description,
          steps:       input.steps,
          schedule:    input.schedule,
          is_active:   true
        }, { onConflict: 'merchant_id,name' })
        .select('id')
        .single()
      return { playbook_id: data?.id, name: input.name, saved: true }
    }
  } as any)

// Tool 2: Run a playbook immediately — medium risk
export const runPlaybook = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Execute a saved playbook immediately. The agent will run through each step in sequence.',
    parameters: z.object({
      playbook_name: z.string().describe('The exact playbook name as saved'),
      context:       z.string().optional().describe('Optional context or overrides for this run e.g. "only process Shopee orders"')
    }),
    execute: (input: any) =>
      executeWithGuard('run_playbook', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => edgeCall('run-playbook', { ...input, merchant_id: merchantId, session_id: sessionId }))
  } as any)

// Tool 3: List active playbooks — low risk
export const listPlaybooks = (merchantId: string, sessionId: string) =>
  tool({
    description: 'List all saved playbooks for this merchant, including their schedule and last run status.',
    parameters: z.object({
      status: z.enum(['active', 'paused', 'all']).default('active')
    }),
    execute: async (input: any) => {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const query = supabase
        .from('agent_playbooks')
        .select('id, name, description, schedule, is_active, last_run_at, last_run_status')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })

      if (input.status !== 'all') {
        query.eq('is_active', input.status === 'active')
      }

      const { data } = await query
      return data ?? []
    }
  } as any)

// Tool 4: Push a proactive alert to the dashboard — low risk
export const pushDashboardAlert = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Push a proactive alert or insight card to the merchant dashboard. Use this during scheduled runs to surface findings without waiting for the merchant to ask.',
    parameters: z.object({
      title:    z.string().describe('Short alert title e.g. "Revenue down 23% today"'),
      body:     z.string().describe('Full explanation of the alert and recommended action'),
      severity: z.enum(['info', 'warning', 'critical']),
      category: z.enum(['revenue', 'orders', 'logistics', 'stock', 'payments', 'einvoice', 'crm']),
      action:   z.object({
        label:   z.string().describe('CTA button label e.g. "View orders" or "Fix now"'),
        message: z.string().describe('Message to pre-fill in agent chat when merchant clicks the CTA')
      }).optional()
    }),
    execute: async (input: any) => {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data } = await supabase
        .from('agent_alerts')
        .insert({
          merchant_id: merchantId,
          session_id:  sessionId,
          ...input,
          is_read:     false
        })
        .select('id')
        .single()
      return { alert_id: data?.id, pushed: true }
    }
  } as any)

// Tool 5: Get merchant context snapshot — low risk
export const getMerchantSnapshot = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Get a full context snapshot of current business state: pending orders, stock alerts, and financial summary (including expenses).',
    parameters: z.object({
      daysLookback: z.number().default(30).describe('How many days back to include in the snapshot')
    }),
    execute: (input: any) =>
      executeWithGuard('get_merchant_snapshot', input, { riskLevel: 'low' }, merchantId, sessionId,
        async () => {
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )
          const now = new Date()
          const start = new Date(now.getTime() - (input.daysLookback * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
          const end   = now.toISOString().split('T')[0]
          
          const { data, error } = await supabase.rpc('get_dashboard_overview', {
            p_merchant_id: merchantId,
            p_start: start,
            p_end: end
          })
          if (error) throw new Error(`Failed to get merchant snapshot: ${error.message}`)
          return data
        })
  } as any)

