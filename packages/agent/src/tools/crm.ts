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

// Tool 1: Get customer profile — low risk
export const getCustomerProfile = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Fetch a customer profile including full purchase history, loyalty point balance, lifetime value, and last order date.',
    parameters: z.object({
      identifier:      z.string()
                       .describe('Customer ID, email address, or phone number'),
      identifier_type: z.enum(['customer_id', 'email', 'phone']).default('customer_id')
    }),
    execute: (input: any) =>
      executeWithGuard('get_customer_profile', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('get-customer-profile', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 2: Get customer segments — low risk
export const getCustomerSegments = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Classify and list customers by segment. Segments: VIP (top 10% by spend), loyal (3+ orders), at-risk (no order in 60 days), new (first order within 30 days), lapsed (no order in 180 days).',
    parameters: z.object({
      segment:   z.enum(['vip', 'loyal', 'at_risk', 'new', 'lapsed', 'all']).default('all'),
      limit:     z.number().min(1).max(100).default(20),
      sort_by:   z.enum(['lifetime_value', 'last_order_date', 'order_count']).default('lifetime_value')
    }),
    execute: (input: any) =>
      executeWithGuard('get_customer_segments', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('customer-segments', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 3: Award loyalty points — medium risk
export const awardLoyaltyPoints = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Manually award loyalty points to a customer for a completed order or as a goodwill gesture. Use only after verifying the order is completed.',
    parameters: z.object({
      customer_id: z.string(),
      points:      z.number().int().positive().max(10000)
                   .describe('Number of points to award — 1 point = RM0.01 redemption value'),
      reason:      z.string().describe('Reason for awarding points e.g. "Completed order #SHP-001" or "Goodwill gesture for late delivery"'),
      order_id:    z.string().optional()
                   .describe('Associate with a specific order if applicable')
    }),
    execute: (input: any) =>
      executeWithGuard('award_loyalty_points', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => edgeCall('award-loyalty-points', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 4: Process point redemption — high risk
export const processPointRedemption = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Apply a loyalty point redemption to an active order, reducing the order total. Points are deducted from the customer balance immediately upon execution.',
    parameters: z.object({
      customer_id: z.string(),
      order_id:    z.string(),
      points:      z.number().int().positive()
                   .describe('Points to redeem — must not exceed customer balance or order total in point-equivalent value'),
      discount_rm: z.number().positive()
                   .describe('Equivalent discount amount in RM')
    }),
    execute: (input: any) =>
      executeWithGuard('process_point_redemption', input, {
        riskLevel:           'high',
        approvalTitle:       (i: any) =>
          `Redeem ${i.points} Points for Order #${i.order_id} (−RM${i.discount_rm})`,
        approvalDescription: (i: any) =>
          `Agent wants to redeem ${i.points} loyalty points for customer ${i.customer_id} ` +
          `on order #${i.order_id}, applying a discount of RM${i.discount_rm}.`
      }, merchantId, sessionId,
        () => edgeCall('process-point-redemption', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 5: Send loyalty notification — medium risk
export const sendLoyaltyNotification = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Send a loyalty-related notification to one or more customers. Use for point balance updates, tier upgrades, expiry warnings, or promotional messages.',
    parameters: z.object({
      customer_ids: z.array(z.string()).min(1).max(500),
      type:         z.enum([
                      'points_awarded',
                      'points_expiring',
                      'tier_upgrade',
                      'redemption_reminder',
                      'win_back'           // for at-risk/lapsed segments
                    ]),
      channel:      z.enum(['email', 'sms', 'both']).default('email'),
      custom_message: z.string().optional()
                    .describe('Optional custom message body — if omitted, uses default template for the notification type')
    }),
    execute: (input: any) =>
      executeWithGuard('send_loyalty_notification', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => edgeCall('send-loyalty-notification', { ...input, merchant_id: merchantId }))
  } as any)
