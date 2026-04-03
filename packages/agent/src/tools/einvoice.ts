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

// Tool 1: List orders pending e-invoicing — low risk
export const listPendingInvoices = (merchantId: string, sessionId: string) =>
  tool({
    description: 'List all completed orders that have not yet had an e-invoice generated and submitted to LHDN. Use this before any batch submission.',
    parameters: z.object({
      date_from:    z.string().optional().describe('ISO date — only include orders after this date'),
      date_to:      z.string().optional().describe('ISO date — only include orders before this date'),
      marketplace:  z.enum(['shopee', 'lazada', 'tiktok', 'all']).default('all'),
      invoice_type: z.enum(['individual', 'consolidated', 'all']).default('all')
                    .describe('individual = B2B orders requiring named invoice, consolidated = B2C orders that can be batched monthly')
    }),
    execute: (input: any) =>
      executeWithGuard('list_pending_invoices', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('list-pending-invoices', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 2: Generate e-invoice for a single order — medium risk
export const generateEinvoice = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Generate and submit an e-invoice to LHDN for a single completed order. Use for B2B orders where the buyer requires a named invoice. Returns LHDN UUID and submission status.',
    parameters: z.object({
      order_id:     z.string(),
      buyer_tin:    z.string().optional()
                    .describe('Buyer TIN number — required for B2B invoices above RM500'),
      buyer_name:   z.string().optional(),
      buyer_address: z.string().optional(),
      buyer_sst_reg: z.string().optional()
                    .describe('Buyer SST registration number if applicable')
    }),
    execute: (input: any) =>
      executeWithGuard('generate_einvoice', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => edgeCall('generate-einvoice', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 3: Batch submit invoices to LHDN — high risk
export const batchSubmitInvoices = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Submit a batch of e-invoices to LHDN in one operation. Use for end-of-day or end-of-week bulk submissions. LHDN allows up to 100 invoices per batch.',
    parameters: z.object({
      order_ids:    z.array(z.string()).min(1).max(100)
                    .describe('Order IDs to include in the batch — all must be completed and unpaid invoiced'),
      submission_note: z.string().optional()
                    .describe('Internal reference note for this batch')
    }),
    execute: (input: any) =>
      executeWithGuard('batch_submit_invoices', input, {
        riskLevel:           'high',
        approvalTitle:       (i: any) =>
          `Submit ${i.order_ids.length} E-Invoice(s) to LHDN`,
        approvalDescription: (i: any) =>
          `Agent wants to submit a batch of ${i.order_ids.length} e-invoice(s) to LHDN MyInvois.` +
          ` This will create legally binding invoice records. First order: #${i.order_ids[0]}`
      }, merchantId, sessionId,
        () => edgeCall('batch-submit-invoices', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 4: Check LHDN submission status — low risk
export const checkLhdnSubmissionStatus = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Poll LHDN MyInvois for the current status of a submitted invoice or batch. Returns status: valid, invalid, cancelled, or pending.',
    parameters: z.object({
      identifiers:     z.array(z.string()).min(1)
                       .describe('LHDN UUIDs or internal batch IDs to check'),
      identifier_type: z.enum(['lhdn_uuid', 'batch_id', 'order_id']).default('order_id')
    }),
    execute: (input: any) =>
      executeWithGuard('check_lhdn_submission_status', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('check-lhdn-status', { ...input, merchant_id: merchantId }))
  } as any)

// Tool 5: Generate consolidated invoice — high risk
export const generateConsolidatedInvoice = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Generate a single consolidated e-invoice for multiple B2C orders in a given period. Used for retail transactions under RM200 or where individual invoices are not required. Submit monthly per LHDN guidelines.',
    parameters: z.object({
      period_from:  z.string().describe('ISO date — start of consolidation period'),
      period_to:    z.string().describe('ISO date — end of consolidation period'),
      marketplace:  z.enum(['shopee', 'lazada', 'tiktok', 'all']).default('all'),
      max_amount:   z.number().default(200)
                    .describe('Only consolidate orders below this amount in RM — default 200 per LHDN guidelines')
    }),
    execute: (input: any) =>
      executeWithGuard('generate_consolidated_invoice', input, {
        riskLevel:           'high',
        approvalTitle:       (i: any) =>
          `Generate Consolidated Invoice: ${i.period_from} to ${i.period_to}`,
        approvalDescription: (i: any) =>
          `Agent wants to generate a consolidated e-invoice for all B2C orders ` +
          `from ${i.period_from} to ${i.period_to} on ${i.marketplace}. ` +
          `Only orders below RM${i.max_amount} will be included.`
      }, merchantId, sessionId,
        () => edgeCall('generate-consolidated-invoice', { ...input, merchant_id: merchantId }))
  } as any)
