import { tool } from 'ai'
import { z } from 'zod'
import { executeWithGuard } from '../middleware/executor'

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

// Tool 1: Compare performance across periods — low risk
export const comparePerformance = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Compare sales, order count, fulfillment speed, and customer metrics between two time periods. Use this for week-over-week, month-over-month, or custom range comparisons.',
    parameters: z.object({
      period_a:   z.object({
        from: z.string().describe('ISO date — start of period A'),
        to:   z.string().describe('ISO date — end of period A')
      }),
      period_b:   z.object({
        from: z.string().describe('ISO date — start of period B'),
        to:   z.string().describe('ISO date — end of period B')
      }),
      metrics: z.array(z.enum([
        'revenue', 'order_count', 'avg_order_value',
        'fulfillment_rate', 'return_rate', 'new_customers',
        'repeat_customers', 'delivery_cost'
      ])).default(['revenue', 'order_count', 'avg_order_value'])
    }),
    execute: (input: any) =>
      executeWithGuard('compare_performance', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('compare-performance', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 2: Detect anomalies — low risk
export const detectAnomalies = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Scan recent business data for anomalies: sudden revenue drops, unusual cancellation spikes, stock running out faster than normal, or payment failure rate increases. Returns a prioritised list of issues.',
    parameters: z.object({
      lookback_hours: z.number().min(1).max(168).default(24)
                      .describe('How far back to scan for anomalies in hours'),
      categories:     z.array(z.enum([
                        'revenue', 'orders', 'logistics', 'stock',
                        'payments', 'marketplace', 'all'
                      ])).default(['all']),
      sensitivity:    z.enum(['low', 'medium', 'high']).default('medium')
                      .describe('Detection threshold — high catches more anomalies but produces more false positives')
    }),
    execute: (input: any) =>
      executeWithGuard('detect_anomalies', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('detect-anomalies', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 3: Generate business report — low risk
export const generateBusinessReport = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Generate a comprehensive business health report covering revenue, top products, fulfillment performance, payment collection, and customer trends for a given period.',
    parameters: z.object({
      period:      z.enum(['daily', 'weekly', 'monthly']),
      date:        z.string().describe('ISO date — the report date. For weekly/monthly, this is the end date.'),
      format:      z.enum(['summary', 'detailed']).default('summary')
                   .describe('summary = key metrics only, detailed = full breakdown per channel and product')
    }),
    execute: (input: any) =>
      executeWithGuard('generate_business_report', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('generate-business-report', { ...input, merchant_id: merchantId }))
  } as any)
