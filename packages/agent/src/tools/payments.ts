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

// Tool 1: Create a payment link — medium risk
export const createPaymentLink = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Generate a payment link for an order using Billplz or Razorpay. Use this for unpaid orders where the customer needs to complete payment.',
    parameters: z.object({
      order_id:    z.string(),
      gateway:     z.enum(['billplz', 'razorpay']).default('billplz')
                   .describe('Payment gateway — use Billplz for Malaysian FPX payments, Razorpay for card/international'),
      send_to_customer: z.boolean().default(false)
                   .describe('Whether to automatically send the link to the customer via their registered contact')
    }),
    execute: (input: any) =>
      executeWithGuard('create_payment_link', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => edgeCall('create-payment-link', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 2: Verify payment status — low risk
export const verifyPaymentStatus = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Check the current payment status for one or more orders. Use this to confirm if a payment has settled before processing an order.',
    parameters: z.object({
      order_ids: z.array(z.string()).min(1).max(50)
    }),
    execute: (input: any) =>
      executeWithGuard('verify_payment_status', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('verify-payment-status', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 3: Process a refund — high risk
export const processRefund = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Initiate a full or partial refund for a paid order. This is irreversible once processed by the payment gateway.',
    parameters: z.object({
      order_id:       z.string(),
      amount_rm:      z.number().positive()
                      .describe('Refund amount in RM — must be less than or equal to the original payment amount'),
      reason:         z.string().describe('Reason for refund'),
      refund_type:    z.enum(['full', 'partial']).default('full')
    }),
    execute: (input: any) =>
      executeWithGuard('process_refund', input, {
        riskLevel:           'high',
        approvalTitle:       (i: any) =>
          `Refund RM${i.amount_rm} for Order #${i.order_id}`,
        approvalDescription: (i: any) =>
          `Agent wants to process a ${i.refund_type} refund of RM${i.amount_rm} for order #${i.order_id}. Reason: ${i.reason}`
      }, merchantId, sessionId,
        () => edgeCall('process-refund', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 4: Get payment report — low risk
export const getPaymentReport = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Get a payment summary including total collected, pending payments, failed transactions, and refunds for a given period.',
    parameters: z.object({
      period:  z.enum(['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month']),
      gateway: z.enum(['billplz', 'razorpay', 'all']).default('all')
    }),
    execute: (input: any) =>
      executeWithGuard('get_payment_report', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('payment-report', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 5: List unpaid orders — low risk
export const listUnpaidOrders = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Find all orders that have not yet received payment. Returns order ID, customer name, amount owed, and how long the payment has been pending.',
    parameters: z.object({
      older_than_hours: z.number().min(1).default(24)
                        .describe('Only return orders where payment has been pending for more than this many hours'),
      marketplace:      z.enum(['shopee', 'lazada', 'tiktok', 'all']).default('all')
    }),
    execute: (input: any) =>
      executeWithGuard('list_unpaid_orders', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('list-unpaid-orders', { ...input, merchant_id: merchantId }))
  } as any)
