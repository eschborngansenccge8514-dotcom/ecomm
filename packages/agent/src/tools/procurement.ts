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

// Tool 1: List Purchase Orders — low risk
export const listPurchaseOrders = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Fetch purchase orders with optional filters for status, date range or limit. Use this to track inventory replenishment and supplier orders.',
    parameters: z.object({
      status: z.enum(['draft', 'sent', 'confirmed', 'received', 'cancelled']).optional(),
      date_from: z.string().optional().describe('ISO date e.g. 2023-01-01'),
      date_to: z.string().optional().describe('ISO date e.g. 2023-12-31'),
      limit: z.number().min(1).max(50).default(10)
    }),
    execute: (input: any) =>
      executeWithGuard('list_purchase_orders', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('list-purchase-orders', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 2: Get Purchase Order Details — low risk
export const getPurchaseOrderDetails = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Get full details for a single purchase order (PO) by ID, including line items, supplier info, and expected delivery date.',
    parameters: z.object({
      po_id: z.string().describe('The purchase order UUID')
    }),
    execute: (input: any) =>
      executeWithGuard('get_purchase_order_details', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('get-purchase-order', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 3: Create Purchase Order — high risk
export const createPurchaseOrder = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Create a new draft purchase order. Use this when the merchant wants to restock products from a supplier.',
    parameters: z.object({
      supplier_id: z.string().describe('The UUID of the supplier'),
      expected_date: z.string().optional().describe('ISO date of expected delivery'),
      notes: z.string().optional().describe('Instructions or notes for the order'),
      items: z.array(z.object({
        product_id: z.string(),
        variant_id: z.string().optional(),
        quantity_ordered: z.number().int().positive(),
        unit_cost: z.number().positive()
      })).min(1).describe('List of items to order')
    }),
    execute: (input: any) =>
      executeWithGuard('create_purchase_order', input, {
        riskLevel:           'high',
        approvalTitle:       () => 'Create Purchase Order',
        approvalDescription: (i: any) =>
          `Agent wants to create a new purchase order for supplier ID ${i.supplier_id} with ${i.items.length} item(s).`
      }, merchantId, sessionId,
        () => edgeCall('create-purchase-order', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 4: Send Purchase Order — high risk
export const sendPurchaseOrder = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Mark a purchase order as "sent" and automatically email it to the supplier. Always confirm with the merchant before sending.',
    parameters: z.object({
      po_id: z.string().describe('The purchase order UUID to send')
    }),
    execute: (input: any) =>
      executeWithGuard('send_purchase_order', input, {
        riskLevel:           'high',
        approvalTitle:       (i: any) => `Send Purchase Order ${i.po_id}`,
        approvalDescription: (i: any) =>
          `Agent wants to finalize and email purchase order ${i.po_id} to the supplier.`
      }, merchantId, sessionId,
        () => edgeCall('send-purchase-order', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 5: List Suppliers — low risk
export const listSuppliers = (merchantId: string, sessionId: string) =>
  tool({
    description: 'List suppliers configured for this merchant. Use this to find the correct supplier ID before creating a purchase order.',
    parameters: z.object({
      limit: z.number().min(1).max(100).default(50)
    }),
    execute: (input: any) =>
      executeWithGuard('list_suppliers', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('list-suppliers', { ...input, merchant_id: merchantId }))
  } as any)
