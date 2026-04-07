import { tool } from 'ai'
import { z } from 'zod'
import { executeWithGuard } from '../middleware/executor'
import { createClient } from '@supabase/supabase-js'

function edgeCall(path: string, body: object) {
  return fetch(`${process.env.SUPABASE_URL}/functions/v1/${path}`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json())
}

export const getSalesSummary = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Get total revenue, order count, and average order value for a time period.',
    parameters: z.object({
      startDate: z.string().describe('ISO date string (YYYY-MM-DD)'),
      endDate: z.string().describe('ISO date string (YYYY-MM-DD)')
    }),
    execute: async (input: any) =>
      executeWithGuard('get_sales_summary', input, { riskLevel: 'low' }, merchantId, sessionId,
        async () => {
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )
          const { data, error } = await supabase.rpc('get_dashboard_overview', {
            p_merchant_id: merchantId,
            p_start: input.startDate,
            p_end: input.endDate
          })
          if (error) throw new Error(`Failed to get sales summary: ${error.message}`)
          return data
        })
  } as any)

