import { tool } from 'ai'
import { z } from 'zod'
import { executeWithGuard } from '../middleware/executor'

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
      period: z.enum(['today','yesterday','this_week','last_week','this_month','last_month'])
    }),
    execute: (input) =>
      executeWithGuard('get_sales_summary', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('sales-summary', { ...input, merchant_id: merchantId }))
  })
