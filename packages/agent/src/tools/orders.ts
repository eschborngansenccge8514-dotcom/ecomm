import { tool } from 'ai'
import { z } from 'zod'
import { executeWithGuard } from '../middleware/executor'

function edgeCall(path: string, body: object) {
  // Use Vercel KV or server-side env vars for SUPABASE_URL and ANON_KEY
  return fetch(`${process.env.SUPABASE_URL}/functions/v1/${path}`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify(body)
  }).then(r => r.json())
}

const listOrdersParams = z.object({
  status:      z.enum(['pending', 'paid', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled']).optional(),
  marketplace: z.enum(['shopee', 'lazada', 'tiktok', 'self']).optional(),
  period:      z.enum(['today', 'yesterday', 'this_week', 'this_month']).optional(),
  limit:       z.number().min(1).max(50).default(10)
})

export const listOrders = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Fetch orders with optional filters for status, marketplace, or date range. Use this to answer questions about order counts, recent orders, or pending orders.',
    parameters: listOrdersParams,
    execute: (input: any) =>
      executeWithGuard('list_orders', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('list-orders', { ...input, merchant_id: merchantId }))
  } as any)

export const getOrderDetails = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Get full details for a single order by ID, including line items, customer info, and shipment status.',
    parameters: z.object({
      order_id: z.string().describe('The order ID e.g. SHP-8821')
    }),
    execute: (input: any) =>
      executeWithGuard('get_order_details', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('get-order', { ...input, merchant_id: merchantId }))
  } as any)

const updateOrderStatusParams = z.object({
  order_id:   z.string(),
  new_status: z.enum(['processing', 'shipped', 'completed']),
  note:       z.string().optional().describe('Optional internal note for the status change')
})

export const updateOrderStatus = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Update the status of a single order. Use this to mark orders as processing, shipped, or completed. Do not use for cancellations — use cancel_order instead.',
    parameters: updateOrderStatusParams,
    execute: (input: any) =>
      executeWithGuard('update_order_status', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => edgeCall('update-order-status', { ...input, merchant_id: merchantId }))
  } as any)

const bulkMarkReadyParams = z.object({
  order_ids:   z.array(z.string()).optional().describe('Optional specific order IDs to mark ready'),
  marketplace: z.enum(['shopee', 'lazada', 'tiktok', 'all']).optional()
                .describe('Filter by marketplace — omit to mark across all channels')
})

export const bulkMarkReady = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Mark multiple orders as "Ready for Pickup" in one go. Useful before booking bulk shipments.',
    parameters: bulkMarkReadyParams,
    execute: (input: any) =>
      executeWithGuard('bulk_mark_ready', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => edgeCall('bulk-mark-ready', { ...input, merchant_id: merchantId }))
  } as any)

const searchOrdersParams = z.object({
  query:       z.string().describe('Search term'),
  limit:       z.number().min(1).max(50).default(10)
})

export const searchOrders = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Search for orders by order number, customer name, or item names.',
    parameters: searchOrdersParams,
    execute: (input: any) =>
      executeWithGuard('search_orders', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('search-orders', { ...input, merchant_id: merchantId }))
  } as any)

export const cancelOrder = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Cancel an order. Always confirm the order ID and reason with the merchant before calling this tool.',
    parameters: z.object({
      order_id: z.string(),
      reason:   z.string()
    }),
    execute: (input: any) =>
      executeWithGuard('cancel_order', input, {
        riskLevel:           'high',
        approvalTitle:       (i: any) => `Cancel Order #${i.order_id}`,
        approvalDescription: (i: any) =>
          `Agent wants to cancel order #${i.order_id}. Reason: ${i.reason}`
      }, merchantId, sessionId,
        () => edgeCall('cancel-order', { ...input, merchant_id: merchantId }))
  } as any)
