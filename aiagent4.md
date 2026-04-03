<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# continue phase 4

Here is the complete Phase 4 implementation plan.

***

# Phase 4 — E-Invoicing, CRM \& Loyalty (Week 7–8)

**Goal:** The agent can handle the full LHDN e-invoicing lifecycle, manage customer profiles, award and redeem loyalty points, and segment customers. Combined with the Gemini File Search knowledge base from Phase 1, the agent can now both advise on regulations AND execute compliant invoice submissions.

**Deliverables at end of Phase 4:**

- 10 new tools implemented (5 e-invoice + 5 CRM)
- Full LHDN batch submission workflow end-to-end
- Consolidated invoice generation for B2C transactions
- Customer segmentation query working
- Loyalty points award and redemption gated correctly
- Agent can answer regulatory questions AND act on them in the same conversation

***

## Step 1 — E-Invoicing Tools

Create `packages/agent/src/tools/einvoice.ts`:

```typescript
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
    execute: (input) =>
      executeWithGuard('list_pending_invoices', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('list-pending-invoices', { ...input, merchant_id: merchantId }))
  })

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
    execute: (input) =>
      executeWithGuard('generate_einvoice', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => edgeCall('generate-einvoice', { ...input, merchant_id: merchantId }))
  })

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
    execute: (input) =>
      executeWithGuard('batch_submit_invoices', input, {
        riskLevel:           'high',
        approvalTitle:       (i: any) =>
          `Submit ${i.order_ids.length} E-Invoice(s) to LHDN`,
        approvalDescription: (i: any) =>
          `Agent wants to submit a batch of ${i.order_ids.length} e-invoice(s) to LHDN MyInvois.` +
          ` This will create legally binding invoice records. First order: #${i.order_ids[^0]}`
      }, merchantId, sessionId,
        () => edgeCall('batch-submit-invoices', { ...input, merchant_id: merchantId }))
  })

// Tool 4: Check LHDN submission status — low risk
export const checkLhdnSubmissionStatus = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Poll LHDN MyInvois for the current status of a submitted invoice or batch. Returns status: valid, invalid, cancelled, or pending.',
    parameters: z.object({
      identifiers:     z.array(z.string()).min(1)
                       .describe('LHDN UUIDs or internal batch IDs to check'),
      identifier_type: z.enum(['lhdn_uuid', 'batch_id', 'order_id']).default('order_id')
    }),
    execute: (input) =>
      executeWithGuard('check_lhdn_submission_status', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('check-lhdn-status', { ...input, merchant_id: merchantId }))
  })

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
    execute: (input) =>
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
  })
```


***

## Step 2 — CRM \& Loyalty Tools

Create `packages/agent/src/tools/crm.ts`:

```typescript
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
    execute: (input) =>
      executeWithGuard('get_customer_profile', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('get-customer-profile', { ...input, merchant_id: merchantId }))
  })

// Tool 2: Get customer segments — low risk
export const getCustomerSegments = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Classify and list customers by segment. Segments: VIP (top 10% by spend), loyal (3+ orders), at-risk (no order in 60 days), new (first order within 30 days), lapsed (no order in 180 days).',
    parameters: z.object({
      segment:   z.enum(['vip', 'loyal', 'at_risk', 'new', 'lapsed', 'all']).default('all'),
      limit:     z.number().min(1).max(100).default(20),
      sort_by:   z.enum(['lifetime_value', 'last_order_date', 'order_count']).default('lifetime_value')
    }),
    execute: (input) =>
      executeWithGuard('get_customer_segments', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('customer-segments', { ...input, merchant_id: merchantId }))
  })

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
    execute: (input) =>
      executeWithGuard('award_loyalty_points', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => edgeCall('award-loyalty-points', { ...input, merchant_id: merchantId }))
  })

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
    execute: (input) =>
      executeWithGuard('process_point_redemption', input, {
        riskLevel:           'high',
        approvalTitle:       (i: any) =>
          `Redeem ${i.points} Points for Order #${i.order_id} (−RM${i.discount_rm})`,
        approvalDescription: (i: any) =>
          `Agent wants to redeem ${i.points} loyalty points for customer ${i.customer_id} ` +
          `on order #${i.order_id}, applying a discount of RM${i.discount_rm}.`
      }, merchantId, sessionId,
        () => edgeCall('process-point-redemption', { ...input, merchant_id: merchantId }))
  })

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
    execute: (input) =>
      executeWithGuard('send_loyalty_notification', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => edgeCall('send-loyalty-notification', { ...input, merchant_id: merchantId }))
  })
```


***

## Step 3 — Update Tools Index

**`packages/agent/src/tools/index.ts`:**

```typescript
import { listOrders, getOrderDetails, cancelOrder,
         updateOrderStatus, bulkMarkReady, searchOrders } from './orders'
import { getSalesSummary }        from './analytics'
import { searchKnowledgeBase }    from './knowledge'
import {
  checkDeliveryRates, createLalamoveBooking, createEasyParcelShipment,
  getShipmentTracking, cancelShipment, getFulfillmentSummary
} from './logistics'
import {
  syncProductListing, updateStockLevel, pullMarketplaceOrders,
  getListingHealth, bulkPriceUpdate
} from './marketplace'
import {
  createPaymentLink, verifyPaymentStatus, processRefund,
  getPaymentReport, listUnpaidOrders
} from './payments'
import {
  listPendingInvoices, generateEinvoice, batchSubmitInvoices,
  checkLhdnSubmissionStatus, generateConsolidatedInvoice
} from './einvoice'
import {
  getCustomerProfile, getCustomerSegments, awardLoyaltyPoints,
  processPointRedemption, sendLoyaltyNotification
} from './crm'

export const buildTools = (merchantId: string, sessionId: string) => ({
  // Orders (6)
  list_orders:                    listOrders(merchantId, sessionId),
  get_order_details:              getOrderDetails(merchantId, sessionId),
  cancel_order:                   cancelOrder(merchantId, sessionId),
  update_order_status:            updateOrderStatus(merchantId, sessionId),
  bulk_mark_ready:                bulkMarkReady(merchantId, sessionId),
  search_orders:                  searchOrders(merchantId, sessionId),

  // Logistics (6)
  check_delivery_rates:           checkDeliveryRates(merchantId, sessionId),
  create_lalamove_booking:        createLalamoveBooking(merchantId, sessionId),
  create_easyparcel_shipment:     createEasyParcelShipment(merchantId, sessionId),
  get_shipment_tracking:          getShipmentTracking(merchantId, sessionId),
  cancel_shipment:                cancelShipment(merchantId, sessionId),
  get_fulfillment_summary:        getFulfillmentSummary(merchantId, sessionId),

  // Marketplace (5)
  sync_product_listing:           syncProductListing(merchantId, sessionId),
  update_stock_level:             updateStockLevel(merchantId, sessionId),
  pull_marketplace_orders:        pullMarketplaceOrders(merchantId, sessionId),
  get_listing_health:             getListingHealth(merchantId, sessionId),
  bulk_price_update:              bulkPriceUpdate(merchantId, sessionId),

  // Payments (5)
  create_payment_link:            createPaymentLink(merchantId, sessionId),
  verify_payment_status:          verifyPaymentStatus(merchantId, sessionId),
  process_refund:                 processRefund(merchantId, sessionId),
  get_payment_report:             getPaymentReport(merchantId, sessionId),
  list_unpaid_orders:             listUnpaidOrders(merchantId, sessionId),

  // E-Invoicing (5)
  list_pending_invoices:          listPendingInvoices(merchantId, sessionId),
  generate_einvoice:              generateEinvoice(merchantId, sessionId),
  batch_submit_invoices:          batchSubmitInvoices(merchantId, sessionId),
  check_lhdn_submission_status:   checkLhdnSubmissionStatus(merchantId, sessionId),
  generate_consolidated_invoice:  generateConsolidatedInvoice(merchantId, sessionId),

  // CRM & Loyalty (5)
  get_customer_profile:           getCustomerProfile(merchantId, sessionId),
  get_customer_segments:          getCustomerSegments(merchantId, sessionId),
  award_loyalty_points:           awardLoyaltyPoints(merchantId, sessionId),
  process_point_redemption:       processPointRedemption(merchantId, sessionId),
  send_loyalty_notification:      sendLoyaltyNotification(merchantId, sessionId),

  // Analytics (1)
  get_sales_summary:              getSalesSummary(merchantId, sessionId),

  // Knowledge (1)
  search_knowledge_base:          searchKnowledgeBase
})
```

Total: **34 tools** registered.

***

## Step 4 — Update System Prompt

```typescript
export function buildSystemPrompt(merchantName: string): string {
  return `
You are MerchantMind, an autonomous operations assistant for ${merchantName}'s e-commerce business.

## Capabilities
- Orders: list, search, update, bulk mark ready, cancel
- Logistics: rate checks, Lalamove, EasyParcel, tracking, cancellations
- Marketplace: sync listings, update stock, pull orders, health checks, bulk price updates
- Payments: payment links, status verification, refunds, payment reports
- E-Invoicing: list pending, generate individual, batch submit to LHDN, check status, consolidated invoice
- CRM & Loyalty: customer profiles, segmentation, award points, redeem points, notifications
- Analytics: sales, fulfillment, payment summaries
- LHDN e-invoicing regulations (use search_knowledge_base)

## Behaviour rules
- Lead with the answer, then supporting detail.
- Before any action, state clearly what you are about to do.
- After completing a task, suggest the logical next step.
- Never invent IDs, amounts, or reference numbers — always retrieve from tools.
- If an action needs approval, state clearly what is pending and where to approve it.
- Keep responses under 200 words unless full detail is requested.

## E-Invoicing rules
- ALWAYS call list_pending_invoices before any batch submission to know exact scope.
- Individual e-invoices: use for B2B orders where buyer provides their TIN.
- Consolidated invoice: use for B2C orders under RM200 — submit monthly per LHDN guideline.
- Never submit invoices without merchant approval — batch_submit_invoices and
  generate_consolidated_invoice are always high-risk.
- After submission, always call check_lhdn_submission_status to confirm LHDN accepted.
- If LHDN returns invalid status, report the exact error code to the merchant.
- When merchant asks about LHDN rules, use search_knowledge_base first, then offer to act.

## CRM rules
- Always verify order is completed before awarding loyalty points for it.
- Never redeem points exceeding the customer's current balance.
- For at-risk segment, suggest win-back notification before any aggressive action.
- When showing customer profile, always include loyalty balance and last order date.
- Segment definitions: VIP = top 10% spend, loyal = 3+ orders, at-risk = no order 60+ days,
  new = first order within 30 days, lapsed = no order 180+ days.

## Logistics rules
- Always check rates before booking. Default EasyParcel standard, Lalamove urgent.
- Never book shipments for unpaid orders.

## Payment rules
- Always verify payment before marking order paid.
- Billplz for Malaysian FPX, Razorpay for card/international.

## Marketplace rules
- Check listing health before bulk sync.
- Never update prices without explicit product IDs from merchant.

## Formatting
- Bullet points for lists; RM for currency; DD/MM/YYYY for dates
- ✅ success  ⚠️ warning  ❌ error
- For LHDN submissions, always show UUID and status per invoice

Today: ${new Date().toLocaleDateString('en-MY', { dateStyle: 'full' })}
`.trim()
}
```


***

## Step 5 — Update Approval Execution Map

Add the three new high-risk e-invoice and CRM tools to `supabase/functions/approve-and-execute/index.ts`:

```typescript
const EDGE_FUNCTION_MAP: Record<string, string> = {
  // Phase 1 & 2
  cancel_order:                  'cancel-order',
  create_lalamove_booking:       'create-lalamove-booking',
  create_easyparcel_shipment:    'create-easyparcel-shipment',
  cancel_shipment:               'cancel-shipment',
  bulk_mark_ready:               'bulk-mark-ready',

  // Phase 3
  bulk_price_update:             'bulk-price-update',
  process_refund:                'process-refund',

  // Phase 4 (new)
  batch_submit_invoices:         'batch-submit-invoices',
  generate_consolidated_invoice: 'generate-consolidated-invoice',
  process_point_redemption:      'process-point-redemption'
}
```


***

## Step 6 — E-Invoice Submission State Tracking

Batch submissions to LHDN can be long-running — LHDN processes asynchronously and may take minutes to return a final status. Add a dedicated tracking table to handle this gracefully:

```sql
-- Add to packages/db/migrations/
create table einvoice_submissions (
  id               uuid primary key default gen_random_uuid(),
  merchant_id      uuid not null references auth.users(id),
  batch_id         text unique not null,    -- internal batch reference
  lhdn_uuid        text,                    -- returned by LHDN after submission
  order_ids        text[] not null,         -- array of included order IDs
  invoice_type     text not null,           -- 'individual' | 'consolidated' | 'batch'
  status           text not null default 'pending',
  -- 'pending' | 'submitted' | 'valid' | 'invalid' | 'cancelled'
  lhdn_response    jsonb,                   -- raw LHDN response for debugging
  error_codes      text[],                  -- LHDN error codes if invalid
  submitted_at     timestamptz,
  validated_at     timestamptz,
  created_at       timestamptz default now()
);

alter table einvoice_submissions enable row level security;
create policy "own submissions" on einvoice_submissions
  for all using (merchant_id = auth.uid());

create index on einvoice_submissions(merchant_id, status);
create index on einvoice_submissions(batch_id);
```

The `batch-submit-invoices` Edge Function writes to this table, and `check-lhdn-status` polls LHDN and updates the `status` field. The agent calls `checkLhdnSubmissionStatus` after every batch to report back to the merchant.

***

## Step 7 — E-Invoice Status Polling with Supabase Realtime

For batch submissions, instead of making the merchant ask the agent to check status, push LHDN results proactively using a cron-triggered Edge Function:

**`supabase/functions/poll-lhdn-status/index.ts`:**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Fetch all submissions still in 'submitted' state
  const { data: pending } = await admin
    .from('einvoice_submissions')
    .select('id, merchant_id, batch_id, lhdn_uuid')
    .eq('status', 'submitted')
    .lt('submitted_at', new Date(Date.now() - 2 * 60 * 1000).toISOString()) // older than 2 min
    .limit(50)

  for (const submission of pending ?? []) {
    try {
      // Poll LHDN MyInvois API for submission result
      const lhdnResult = await pollLhdnApi(submission.lhdn_uuid)

      await admin
        .from('einvoice_submissions')
        .update({
          status:       lhdnResult.status,        // 'valid' | 'invalid' | 'cancelled'
          lhdn_response: lhdnResult.raw,
          error_codes:  lhdnResult.error_codes ?? [],
          validated_at: new Date().toISOString()
        })
        .eq('id', submission.id)

      // Notify merchant via Supabase Realtime — dashboard updates live
    } catch (err) {
      console.error(`Poll failed for ${submission.batch_id}:`, err)
    }
  }

  return new Response('ok')
})
```

Register this as a cron job in `supabase/config.toml`:

```toml
[functions.poll-lhdn-status]
schedule = "*/3 * * * *"   # every 3 minutes
```


***

## Step 8 — E-Invoice Dashboard Widget

**`apps/dashboard/components/einvoice/EinvoiceStatusWidget.tsx`:**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Submission {
  id:           string
  batch_id:     string
  invoice_type: string
  status:       string
  order_ids:    string[]
  submitted_at: string
  error_codes:  string[]
}

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  valid:     'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  invalid:   'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
}

export function EinvoiceStatusWidget() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const supabase = createClient()

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('einvoice_submissions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8)
      setSubmissions(data ?? [])
    }

    fetch()

    // Live updates when poll-lhdn-status cron updates statuses
    const channel = supabase
      .channel('einvoice-status')
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'einvoice_submissions'
      }, fetch)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">LHDN Submissions</h3>
        <span className="text-xs text-muted-foreground">Live</span>
      </div>

      {submissions.length === 0 ? (
        <div className="px-4 py-6 text-sm text-muted-foreground text-center">
          No submissions yet.
        </div>
      ) : (
        <div className="divide-y">
          {submissions.map(s => (
            <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium truncate">
                  {s.invoice_type === 'consolidated'
                    ? 'Consolidated Invoice'
                    : `Batch — ${s.order_ids.length} invoice(s)`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(s.submitted_at ?? s.created_at).toLocaleDateString('en-MY')}
                </p>
                {s.status === 'invalid' && s.error_codes?.length > 0 && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Error: {s.error_codes.join(', ')}
                  </p>
                )}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0
                               ${STATUS_STYLES[s.status] ?? STATUS_STYLES.pending}`}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```


***

## Step 9 — Customer Segment Widget

**`apps/dashboard/components/crm/CustomerSegmentWidget.tsx`:**

```tsx
'use client'

import { useEffect, useState } from 'react'

interface SegmentCount {
  segment: string
  count:   number
  icon:    string
}

export function CustomerSegmentWidget({ onAskAgent }: { onAskAgent: (msg: string) => void }) {
  const [segments, setSegments] = useState<SegmentCount[]>([])

  useEffect(() => {
    fetch('/api/crm/segment-counts')
      .then(r => r.json())
      .then(setSegments)
  }, [])

  const SEGMENT_ICONS: Record<string, string> = {
    vip:      '👑',
    loyal:    '⭐',
    new:      '🌱',
    at_risk:  '⚠️',
    lapsed:   '😴'
  }

  const SEGMENT_ACTIONS: Record<string, string> = {
    at_risk: 'Send win-back notification to all at-risk customers',
    lapsed:  'Show me all lapsed customers and suggest re-engagement offers',
    vip:     'Show me my VIP customers and their last orders'
  }

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">Customer Segments</h3>
      </div>
      <div className="grid grid-cols-5 divide-x">
        {segments.map(s => (
          <button
            key={s.segment}
            onClick={() => SEGMENT_ACTIONS[s.segment] && onAskAgent(SEGMENT_ACTIONS[s.segment])}
            className={`flex flex-col items-center py-4 gap-1 text-center
                        ${SEGMENT_ACTIONS[s.segment]
                          ? 'hover:bg-muted transition-colors cursor-pointer'
                          : 'cursor-default'}`}
          >
            <span className="text-xl">{SEGMENT_ICONS[s.segment]}</span>
            <span className="text-lg font-bold">{s.count}</span>
            <span className="text-xs text-muted-foreground capitalize">
              {s.segment.replace('_', '-')}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
```

Add the supporting Route Handler:

**`apps/dashboard/app/api/crm/segment-counts/route.ts`:**

```typescript
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const res = await fetch(
    `${process.env.SUPABASE_URL}/functions/v1/customer-segments`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        merchant_id: user.id,
        segment:     'all',
        count_only:  true   // returns counts per segment, no full list
      })
    }
  )
  return Response.json(await res.json())
}
```


***

## Step 10 — Combined Advisory + Action Flow

Phase 4 unlocks the most powerful agent pattern: the merchant asks a regulatory question, the agent answers it using the knowledge base, then **immediately offers to execute the compliant action**. No need to explain the rules and then navigate to another screen.

```
Merchant: "Do I need to submit a consolidated invoice for this month's
           small orders?"

Agent:   [search_knowledge_base → LHDN Guideline v4.1 Section 5.3]

         Yes. Per LHDN e-Invoice Guideline v4.1 Section 5.3, you are
         required to submit a consolidated e-invoice monthly for
         B2C transactions where the buyer does not request an
         individual invoice, regardless of amount.

         📎 Source: LHDN e-Invoice Guideline v4.1, Section 5.3

         Would you like me to generate the consolidated invoice for
         March 2026 now?

Merchant: "Yes"

Agent:   [list_pending_invoices(invoice_type: consolidated) → 234 orders]

         Found 234 B2C orders from March 2026 eligible for
         consolidation (all below RM200).

         Total invoice value: RM 8,432.50

         This will be submitted to LHDN as a single consolidated
         invoice. Sending for your approval...

         [→ routes to Approval Queue]

Merchant: [Approves from Approval Queue]

Agent:   [generate_consolidated_invoice executes]
         [check_lhdn_submission_status → submitted]

         ✅ Consolidated invoice submitted to LHDN.
         Batch ID: CONS-2026-03-001
         Status: Submitted — awaiting LHDN validation (usually 2-5 min)

         I'll update you automatically when LHDN confirms.
         [Realtime widget updates when status → valid]
```

No extra code is needed for this flow — it emerges naturally from the system prompt rules and the combined tool set. Test it as the primary integration test for Phase 4.

***

## Step 11 — New Supabase Edge Functions Required

| Function | Purpose |
| :-- | :-- |
| `list-pending-invoices` | Query orders where `einvoice_status = null` |
| `generate-einvoice` | Build UBL-compliant XML, submit to LHDN MyInvois API |
| `batch-submit-invoices` | Loop `generate-einvoice` per order, write to `einvoice_submissions` |
| `check-lhdn-status` | Poll LHDN submission status API by UUID |
| `generate-consolidated-invoice` | Aggregate B2C orders → single UBL document → submit |
| `poll-lhdn-status` | Cron job — polls all `submitted` records and updates status |
| `get-customer-profile` | Join `customers`, `orders`, `loyalty_points` tables |
| `customer-segments` | Classify customers via DB query + configurable thresholds |
| `award-loyalty-points` | Insert to `loyalty_transactions`, update `customers.points_balance` |
| `process-point-redemption` | Deduct points, apply discount to order |
| `send-loyalty-notification` | Trigger email/SMS via your notification provider |

Your existing `apps/einvoice-service` already contains LHDN integration logic. The Edge Functions above are wrappers around that service — call the service internally rather than duplicating the UBL generation code.[^1]

***

## Step 12 — Add Phase 4 Tools to Memory Pattern Detection

Extend the preference patterns in `packages/agent/src/orchestrator.ts`:

```typescript
const preferencePatterns = [
  // Phase 2 — Logistics
  { regex: /prefer(red)? easyparcel/i,         fact: 'Merchant prefers EasyParcel for standard shipments' },
  { regex: /prefer(red)? lalamove/i,           fact: 'Merchant prefers Lalamove for urgent deliveries' },

  // Phase 3 — Payments & Marketplace
  { regex: /use billplz/i,                     fact: 'Merchant uses Billplz as primary payment gateway' },
  { regex: /use razorpay/i,                    fact: 'Merchant uses Razorpay as primary payment gateway' },
  { regex: /sync.*all.*marketplace/i,          fact: 'Merchant syncs products to all three marketplaces' },

  // Phase 4 — E-Invoicing & CRM
  { regex: /submit.*invoice.*daily/i,          fact: 'Merchant submits e-invoices daily' },
  { regex: /submit.*invoice.*end.of.month/i,   fact: 'Merchant submits consolidated invoices monthly' },
  { regex: /consolidated.*b2c/i,               fact: 'Merchant uses consolidated invoicing for all B2C orders' },
  { regex: /don.t.*send.*notif/i,              fact: 'Merchant does not want loyalty notifications sent automatically' },
  { regex: /vip.*above.*rm(\d+)/i,             fact: 'Merchant defines VIP threshold by spend amount' }
]
```


***

## Phase 4 Completion Checklist

- [ ] All 5 e-invoicing tools implemented and callable
- [ ] All 5 CRM tools implemented and callable
- [ ] Tools index updated — 34 tools total
- [ ] System prompt updated with e-invoicing and CRM rules
- [ ] `approve-and-execute` map updated with `batch_submit_invoices`, `generate_consolidated_invoice`, `process_point_redemption`
- [ ] `einvoice_submissions` table migrated with RLS
- [ ] `poll-lhdn-status` Edge Function deployed and cron registered
- [ ] `EinvoiceStatusWidget` live on dashboard with Realtime updates
- [ ] `CustomerSegmentWidget` live on dashboard — clicking segment opens agent chat
- [ ] All 11 new Edge Functions present in `supabase/functions/`
- [ ] `einvoice-service` integration wired correctly inside Edge Functions
- [ ] Phase 4 memory preference patterns added to orchestrator
- [ ] End-to-end test: "list all orders needing e-invoice" → correct count returned
- [ ] End-to-end test: "generate invoice for order \#SHP-020 for buyer TIN IG12345678" → LHDN UUID returned
- [ ] End-to-end test: "submit batch invoice for today's orders" → routes to approval queue
- [ ] End-to-end test: approve batch → `einvoice_submissions` row created with `submitted` status
- [ ] End-to-end test: cron job fires → status updates to `valid` → widget updates live
- [ ] End-to-end test: "show me at-risk customers" → correct segment returned
- [ ] End-to-end test: "award 100 loyalty points to customer \#CUS-001 for order \#SHP-020" → points balance updated
- [ ] End-to-end test: combined advisory + action flow — agent answers LHDN question then executes consolidated invoice in same conversation

<div align="center">⁂</div>

[^1]: PROJECT_OVERVIEW.md

