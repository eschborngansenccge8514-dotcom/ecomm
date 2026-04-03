<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# continue with phase 3

Here is the complete Phase 3 implementation plan.

***

# Phase 3 — Marketplace \& Payments (Week 5–6)

**Goal:** The agent can sync products and stock across Shopee, Lazada, and TikTok Shop, ingest orders from all marketplaces, manage payment links and refunds via Billplz and Razorpay, and handle cross-module flows like detecting unpaid orders and generating payment links automatically.

**Deliverables at end of Phase 3:**

- 10 new tools implemented (5 marketplace + 5 payment)
- Cross-module flow: agent detects unpaid orders → generates payment links → reports back
- Marketplace listing health check surfaced in dashboard
- Payment status polling for pending transactions
- Refund workflow gated behind high-risk approval

***

## Step 1 — Marketplace Tools

Create `packages/agent/src/tools/marketplace.ts`:

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

// Tool 1: Sync a product listing to one or more marketplaces — medium risk
export const syncProductListing = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Push product updates (title, description, images, price, category) to one or more marketplaces. Use this when the merchant wants to update a listing on Shopee, Lazada, or TikTok Shop.',
    parameters: z.object({
      product_id:   z.string().describe('Internal product ID'),
      marketplaces: z.array(z.enum(['shopee', 'lazada', 'tiktok', 'google_merchant']))
                     .min(1).describe('Target marketplaces to push to'),
      fields:       z.array(z.enum(['title', 'description', 'price', 'images', 'category', 'all']))
                     .default(['all']).describe('Which fields to sync — use "all" to sync everything')
    }),
    execute: (input) =>
      executeWithGuard('sync_product_listing', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => edgeCall('sync-product-listing', { ...input, merchant_id: merchantId }))
  })

// Tool 2: Update stock level across marketplaces — medium risk
export const updateStockLevel = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Update inventory quantity for a product on one or more marketplaces. Use this to keep stock levels in sync after warehouse changes.',
    parameters: z.object({
      product_id:   z.string(),
      quantity:     z.number().int().min(0)
                    .describe('New stock quantity — use 0 to mark as out of stock'),
      marketplaces: z.array(z.enum(['shopee', 'lazada', 'tiktok', 'google_merchant']))
                    .default(['shopee', 'lazada', 'tiktok'])
    }),
    execute: (input) =>
      executeWithGuard('update_stock_level', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => edgeCall('update-stock-level', { ...input, merchant_id: merchantId }))
  })

// Tool 3: Pull new orders from a marketplace — low risk
export const pullMarketplaceOrders = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Ingest new orders from a marketplace into the dashboard. Run this to fetch orders that have not yet been synced.',
    parameters: z.object({
      marketplace: z.enum(['shopee', 'lazada', 'tiktok', 'all']).default('all'),
      since:       z.string().optional()
                   .describe('ISO datetime — only pull orders after this time. Defaults to last sync time.')
    }),
    execute: (input) =>
      executeWithGuard('pull_marketplace_orders', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('pull-marketplace-orders', { ...input, merchant_id: merchantId }))
  })

// Tool 4: Get listing health report — low risk
export const getListingHealth = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Check all product listings for issues such as missing fields, rejected listings, low stock warnings, or price inconsistencies across marketplaces.',
    parameters: z.object({
      marketplace: z.enum(['shopee', 'lazada', 'tiktok', 'all']).default('all'),
      issue_type:  z.array(z.enum(['missing_fields', 'rejected', 'low_stock', 'price_inconsistency', 'all']))
                   .default(['all'])
    }),
    execute: (input) =>
      executeWithGuard('get_listing_health', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('listing-health', { ...input, merchant_id: merchantId }))
  })

// Tool 5: Bulk price update — high risk
export const bulkPriceUpdate = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Update prices for multiple products across marketplaces in one operation. Use only when the merchant explicitly provides the product IDs and new prices.',
    parameters: z.object({
      updates: z.array(z.object({
        product_id: z.string(),
        new_price:  z.number().positive().describe('New price in RM')
      })).min(1).max(100),
      marketplaces: z.array(z.enum(['shopee', 'lazada', 'tiktok']))
                    .default(['shopee', 'lazada', 'tiktok'])
    }),
    execute: (input) =>
      executeWithGuard('bulk_price_update', input, {
        riskLevel:           'high',
        approvalTitle:       (i: any) =>
          `Bulk Price Update — ${i.updates.length} product(s) on ${i.marketplaces.join(', ')}`,
        approvalDescription: (i: any) => {
          const preview = (i.updates as any[]).slice(0, 3)
            .map((u: any) => `${u.product_id} → RM${u.new_price}`)
            .join(', ')
          return `Agent wants to update prices for ${i.updates.length} product(s): ${preview}${i.updates.length > 3 ? '…' : ''}`
        }
      }, merchantId, sessionId,
        () => edgeCall('bulk-price-update', { ...input, merchant_id: merchantId }))
  })
```


***

## Step 2 — Payment Tools

Create `packages/agent/src/tools/payments.ts`:

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
    execute: (input) =>
      executeWithGuard('create_payment_link', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => edgeCall('create-payment-link', { ...input, merchant_id: merchantId }))
  })

// Tool 2: Verify payment status — low risk
export const verifyPaymentStatus = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Check the current payment status for one or more orders. Use this to confirm if a payment has settled before processing an order.',
    parameters: z.object({
      order_ids: z.array(z.string()).min(1).max(50)
    }),
    execute: (input) =>
      executeWithGuard('verify_payment_status', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('verify-payment-status', { ...input, merchant_id: merchantId }))
  })

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
    execute: (input) =>
      executeWithGuard('process_refund', input, {
        riskLevel:           'high',
        approvalTitle:       (i: any) =>
          `Refund RM${i.amount_rm} for Order #${i.order_id}`,
        approvalDescription: (i: any) =>
          `Agent wants to process a ${i.refund_type} refund of RM${i.amount_rm} for order #${i.order_id}. Reason: ${i.reason}`
      }, merchantId, sessionId,
        () => edgeCall('process-refund', { ...input, merchant_id: merchantId }))
  })

// Tool 4: Get payment report — low risk
export const getPaymentReport = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Get a payment summary including total collected, pending payments, failed transactions, and refunds for a given period.',
    parameters: z.object({
      period:  z.enum(['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month']),
      gateway: z.enum(['billplz', 'razorpay', 'all']).default('all')
    }),
    execute: (input) =>
      executeWithGuard('get_payment_report', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('payment-report', { ...input, merchant_id: merchantId }))
  })

// Tool 5: List unpaid orders — low risk
export const listUnpaidOrders = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Find all orders that have not yet received payment. Returns order ID, customer name, amount owed, and how long the payment has been pending.',
    parameters: z.object({
      older_than_hours: z.number().min(1).default(24)
                        .describe('Only return orders where payment has been pending for more than this many hours'),
      marketplace:      z.enum(['shopee', 'lazada', 'tiktok', 'all']).default('all')
    }),
    execute: (input) =>
      executeWithGuard('list_unpaid_orders', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('list-unpaid-orders', { ...input, merchant_id: merchantId }))
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

export const buildTools = (merchantId: string, sessionId: string) => ({
  // Orders (6)
  list_orders:                listOrders(merchantId, sessionId),
  get_order_details:          getOrderDetails(merchantId, sessionId),
  cancel_order:               cancelOrder(merchantId, sessionId),
  update_order_status:        updateOrderStatus(merchantId, sessionId),
  bulk_mark_ready:            bulkMarkReady(merchantId, sessionId),
  search_orders:              searchOrders(merchantId, sessionId),

  // Logistics (6)
  check_delivery_rates:       checkDeliveryRates(merchantId, sessionId),
  create_lalamove_booking:    createLalamoveBooking(merchantId, sessionId),
  create_easyparcel_shipment: createEasyParcelShipment(merchantId, sessionId),
  get_shipment_tracking:      getShipmentTracking(merchantId, sessionId),
  cancel_shipment:            cancelShipment(merchantId, sessionId),
  get_fulfillment_summary:    getFulfillmentSummary(merchantId, sessionId),

  // Marketplace (5)
  sync_product_listing:       syncProductListing(merchantId, sessionId),
  update_stock_level:         updateStockLevel(merchantId, sessionId),
  pull_marketplace_orders:    pullMarketplaceOrders(merchantId, sessionId),
  get_listing_health:         getListingHealth(merchantId, sessionId),
  bulk_price_update:          bulkPriceUpdate(merchantId, sessionId),

  // Payments (5)
  create_payment_link:        createPaymentLink(merchantId, sessionId),
  verify_payment_status:      verifyPaymentStatus(merchantId, sessionId),
  process_refund:             processRefund(merchantId, sessionId),
  get_payment_report:         getPaymentReport(merchantId, sessionId),
  list_unpaid_orders:         listUnpaidOrders(merchantId, sessionId),

  // Analytics (1)
  get_sales_summary:          getSalesSummary(merchantId, sessionId),

  // Knowledge (1)
  search_knowledge_base:      searchKnowledgeBase
})
```

Total: **24 tools** registered.

***

## Step 4 — Update System Prompt

Extend `packages/agent/src/prompts/system.ts` with marketplace and payment rules:

```typescript
export function buildSystemPrompt(merchantName: string): string {
  return `
You are MerchantMind, an autonomous operations assistant for ${merchantName}'s e-commerce business.

## Capabilities
- Orders: list, search, update, bulk mark ready, cancel
- Logistics: rate checks, Lalamove bookings, EasyParcel shipments, tracking, cancellations
- Marketplace: sync listings, update stock, pull orders, listing health checks, bulk price updates
- Payments: generate payment links, verify status, process refunds, payment reports, unpaid order detection
- Analytics: sales summaries, fulfillment summaries, payment reports
- Malaysia LHDN e-invoicing regulations (use search_knowledge_base)

## Behaviour rules
- Lead with the answer, then supporting detail.
- Before any action, state clearly what you are about to do.
- After completing a task, suggest the logical next step.
- Never invent IDs, amounts, or tracking numbers — always retrieve from tools.
- If an action needs approval, state clearly what is pending and where to approve it.
- Keep responses under 200 words unless full detail is requested.

## Marketplace rules
- Always call get_listing_health before a bulk sync to identify issues first.
- When syncing stock, default to all three marketplaces unless the merchant specifies.
- Never update prices without explicit product IDs and amounts from the merchant.
- After pulling marketplace orders, report new order count by channel.

## Payment rules
- Always call verify_payment_status before marking any order as paid manually.
- Use Billplz for Malaysian customers (FPX bank transfer), Razorpay for international or card payments.
- Never initiate a refund without the merchant confirming the order ID and amount.
- For unpaid orders older than 48 hours, proactively suggest generating payment links or cancelling.

## Cross-module flow rules
- After pull_marketplace_orders, call list_orders to show the new order summary.
- After creating a payment link, offer to update the order status to 'awaiting payment'.
- If verify_payment_status returns settled, automatically suggest booking a shipment next.

## Logistics rules (from Phase 2)
- Always call check_delivery_rates before booking.
- Default EasyParcel for standard, Lalamove for same-day urgent.
- Never book shipments for unpaid orders.

## Formatting
- Bullet points for lists; RM for currency; DD/MM/YYYY for dates
- ✅ success  ⚠️ warning  ❌ error
- For marketplace sync results, show per-channel breakdown

Today: ${new Date().toLocaleDateString('en-MY', { dateStyle: 'full' })}
`.trim()
}
```


***

## Step 5 — Cross-Module Flow: Unpaid Orders

This is the first compound workflow that spans multiple tool categories. Wire it as a natural agent behaviour — no special code needed, just correct system prompt rules. The flow the agent will execute autonomously:

```
Merchant: "Handle all unpaid orders from yesterday"

Agent:
  1. list_unpaid_orders(older_than_hours: 24)         → returns 7 unpaid orders
  2. verify_payment_status([all 7 order IDs])         → confirms none are settled
  3. Reports summary to merchant
  4. Asks: "Should I generate Billplz payment links
     and send them to customers for all 7?"
  5. Merchant: "Yes"
  6. create_payment_link(order_id, send_to_customer: true)  × 7
  7. Reports: "7 payment links created and sent."
  8. Suggests: "Want me to set a reminder to check
     payment status in 24 hours?"
```

Test this flow end-to-end as the primary integration test for Phase 3.

***

## Step 6 — Approval Queue: Add `executeApprovedTool` Mappings

Update the edge function map in `apps/dashboard/app/api/agent/approvals/[id]/route.ts` from Phase 2 to include the new high-risk tools from Phase 3:

```typescript
const edgeFunctionMap: Record<string, string> = {
  // Phase 1 & 2 (existing)
  cancel_order:               'cancel-order',
  create_lalamove_booking:    'create-lalamove-booking',
  create_easyparcel_shipment: 'create-easyparcel-shipment',
  cancel_shipment:            'cancel-shipment',
  bulk_mark_ready:            'bulk-mark-ready',

  // Phase 3 (new)
  bulk_price_update:          'bulk-price-update',
  process_refund:             'process-refund'
}
```


***

## Step 7 — Listing Health Dashboard Widget

Expose listing issues visually on the dashboard home page, separate from the agent chat. This gives merchants a passive view of marketplace health without needing to ask the agent.

**`apps/dashboard/components/marketplace/ListingHealthWidget.tsx`:**

```tsx
'use client'

import { useEffect, useState } from 'react'

interface HealthIssue {
  product_id:   string
  product_name: string
  marketplace:  string
  issue_type:   string
  severity:     'warning' | 'error'
}

interface Props {
  onAskAgent: (message: string) => void
}

export function ListingHealthWidget({ onAskAgent }: Props) {
  const [issues, setIssues] = useState<HealthIssue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/marketplace/listing-health')
      .then(r => r.json())
      .then(data => { setIssues(data ?? []); setLoading(false) })
  }, [])

  if (loading) return (
    <div className="animate-pulse h-24 rounded-xl bg-muted" />
  )

  if (issues.length === 0) return (
    <div className="border rounded-xl p-4 text-sm text-green-700 dark:text-green-300
                    bg-green-50 dark:bg-green-950 flex items-center gap-2">
      <span>✅</span>
      <span>All listings healthy across all marketplaces.</span>
    </div>
  )

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <h3 className="text-sm font-semibold">Listing Issues</h3>
        <span className="text-xs bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300
                         px-2 py-0.5 rounded-full font-medium">
          {issues.length} issue{issues.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="divide-y">
        {issues.slice(0, 5).map((issue, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
            <div className="space-y-0.5 min-w-0">
              <p className="font-medium truncate">{issue.product_name}</p>
              <p className="text-xs text-muted-foreground">
                {issue.marketplace} · {issue.issue_type.replace(/_/g, ' ')}
              </p>
            </div>
            <span className={`text-xs ml-3 shrink-0 ${
              issue.severity === 'error'
                ? 'text-red-600 dark:text-red-400'
                : 'text-yellow-600 dark:text-yellow-400'
            }`}>
              {issue.severity === 'error' ? '❌' : '⚠️'}
            </span>
          </div>
        ))}
      </div>

      {issues.length > 0 && (
        <div className="px-4 py-3 border-t bg-muted/50">
          <button
            onClick={() => onAskAgent(`Fix all ${issues.length} listing issues across my marketplaces`)}
            className="text-xs text-primary font-medium hover:underline"
          >
            Ask MerchantMind to fix all issues →
          </button>
        </div>
      )}
    </div>
  )
}
```

Add a supporting Route Handler to serve the widget data without going through the agent:

**`apps/dashboard/app/api/marketplace/listing-health/route.ts`:**

```typescript
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Call Edge Function directly — no agent overhead for passive widget
  const res = await fetch(
    `${process.env.SUPABASE_URL}/functions/v1/listing-health`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({ merchant_id: user.id, issue_type: ['all'] })
    }
  )
  const data = await res.json()
  return Response.json(data)
}
```

Wire the `onAskAgent` prop into your existing `AgentChatPanel` — pass a setter from the parent page that populates the chat input, opening the panel if collapsed.

***

## Step 8 — Supabase Edge Functions Required

New Edge Functions needed for Phase 3. Each wraps the existing integration code in `packages/integrations`:


| Function | Wraps | Notes |
| :-- | :-- | :-- |
| `sync-product-listing` | Shopee/Lazada/TikTok product update APIs | Fan out per marketplace in parallel |
| `update-stock-level` | Marketplace inventory APIs | Same pattern — parallel per channel |
| `pull-marketplace-orders` | Shopee/Lazada/TikTok order list APIs | Idempotent — skip already-ingested orders |
| `listing-health` | DB query + marketplace status checks | Compare local vs marketplace listing state |
| `bulk-price-update` | Marketplace pricing APIs | Batch per marketplace to respect rate limits |
| `create-payment-link` | Billplz Bill Create / Razorpay Order Create | Return payment URL |
| `verify-payment-status` | Billplz Get Bill / Razorpay Fetch Order | Check settled flag |
| `process-refund` | Billplz Refund / Razorpay Refund API | Map to correct gateway from order record |
| `payment-report` | Aggregate from `payments` table |  |
| `list-unpaid-orders` | Query `orders` where payment_status = pending |  |

Your existing `packages/integrations` code for Shopee, Lazada, TikTok Shop, Billplz, and Razorpay  should already contain the API client logic. Each Edge Function is a thin orchestration wrapper that:[^1]

1. Validates the incoming `merchant_id` and parameters
2. Fetches the merchant's API credentials from Supabase Vault
3. Calls the relevant integration package function
4. Returns a normalised response shape

***

## Step 9 — Merchant API Credentials in Supabase Vault

Phase 3 introduces tools that call external APIs on behalf of the merchant (Shopee, Lazada, Billplz, Razorpay). Each merchant has their own API keys. Store these in **Supabase Vault** — not in a plain table:

```sql
-- Create a table to track which secrets a merchant has configured
-- (Vault stores the actual values encrypted)
create table merchant_integrations (
  id            uuid primary key default gen_random_uuid(),
  merchant_id   uuid not null references auth.users(id),
  provider      text not null,  -- 'shopee' | 'lazada' | 'tiktok' | 'billplz' | 'razorpay'
  is_configured boolean default false,
  configured_at timestamptz,
  unique (merchant_id, provider)
);

alter table merchant_integrations enable row level security;
create policy "own integrations" on merchant_integrations
  for all using (merchant_id = auth.uid());
```

Add a settings page at `/settings/integrations` where merchants enter their API keys. On save, call a Supabase Edge Function that stores secrets via `vault.create_secret()`:

```typescript
// supabase/functions/save-integration-secret/index.ts
Deno.serve(async (req) => {
  const { provider, credentials } = await req.json()
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, jwt!)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Store each credential field in Vault
  const secretName = `${user.id}_${provider}`
  await admin.rpc('vault_upsert_secret', {
    secret_name:  secretName,
    secret_value: JSON.stringify(credentials)
  })

  // Mark as configured
  await admin.from('merchant_integrations').upsert({
    merchant_id:   user.id,
    provider,
    is_configured: true,
    configured_at: new Date().toISOString()
  }, { onConflict: 'merchant_id,provider' })

  return Response.json({ success: true })
})
```

Each Edge Function that needs API credentials retrieves them via:

```typescript
const { data: secret } = await admin.rpc('vault_get_secret', {
  secret_name: `${merchantId}_${provider}`
})
const credentials = JSON.parse(secret)
```


***

## Step 10 — Add Proactive Channel to Agent Memory

After Phase 3 tools run, the agent can now detect patterns worth remembering. Extend the `onFinish` handler in `packages/agent/src/orchestrator.ts`:

```typescript
// Extend existing preference patterns from Phase 2
const preferencePatterns = [
  // Logistics (Phase 2)
  { regex: /prefer(red)? easyparcel/i,    fact: 'Merchant prefers EasyParcel for standard shipments' },
  { regex: /prefer(red)? lalamove/i,      fact: 'Merchant prefers Lalamove for urgent deliveries' },

  // Payment (Phase 3)
  { regex: /use billplz/i,                fact: 'Merchant uses Billplz as primary payment gateway' },
  { regex: /use razorpay/i,               fact: 'Merchant uses Razorpay as primary payment gateway' },
  { regex: /always send.*link.*customer/i, fact: 'Merchant always sends payment links directly to customers' },

  // Marketplace (Phase 3)
  { regex: /sync.*all.*marketplace/i,     fact: 'Merchant syncs products to all three marketplaces' },
  { regex: /tiktok.*only/i,               fact: 'Merchant focuses primarily on TikTok Shop' },
  { regex: /don.t (update|sync).*lazada/i, fact: 'Merchant does not actively use Lazada channel' }
]
```


***

## Step 11 — Supabase Edge Function for `approve-and-execute`

In Phase 2 the approval execution was handled inline in the Next.js Route Handler. Extract it into a dedicated Supabase Edge Function now that the scope has grown. This keeps the Next.js Route Handler thin and moves sensitive gateway calls server-side:

**`supabase/functions/approve-and-execute/index.ts`:**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EDGE_FUNCTION_MAP: Record<string, string> = {
  cancel_order:               'cancel-order',
  create_lalamove_booking:    'create-lalamove-booking',
  create_easyparcel_shipment: 'create-easyparcel-shipment',
  cancel_shipment:            'cancel-shipment',
  bulk_mark_ready:            'bulk-mark-ready',
  bulk_price_update:          'bulk-price-update',
  process_refund:             'process-refund'
}

Deno.serve(async (req) => {
  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, jwt!)
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { approval_id, action, reject_reason }
    : { approval_id: string, action: 'approve' | 'reject', reject_reason?: string } = await req.json()

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: approval } = await admin
    .from('agent_approvals')
    .select('*, agent_actions(session_id)')
    .eq('id', approval_id)
    .eq('merchant_id', user.id)
    .eq('status', 'pending')
    .single()

  if (!approval) return Response.json({ error: 'Not found' }, { status: 404 })

  if (action === 'reject') {
    await admin.from('agent_approvals').update({
      status: 'rejected', approved_by: user.id,
      reject_reason, resolved_at: new Date().toISOString()
    }).eq('id', approval_id)
    await admin.from('agent_actions').update({ status: 'rejected' }).eq('id', approval.action_id)
    return Response.json({ status: 'rejected' })
  }

  // Execute the deferred tool call
  const fn = EDGE_FUNCTION_MAP[approval.tool_name]
  if (!fn) return Response.json({ error: `No function for ${approval.tool_name}` }, { status: 400 })

  const execRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify({ ...approval.tool_input, merchant_id: user.id })
  })

  if (!execRes.ok) {
    const err = await execRes.text()
    await admin.from('agent_actions').update({ status: 'failed', output: { error: err } }).eq('id', approval.action_id)
    return Response.json({ error: err }, { status: 500 })
  }

  const result = await execRes.json()
  await admin.from('agent_approvals').update({
    status: 'approved', approved_by: user.id,
    resolved_at: new Date().toISOString()
  }).eq('id', approval_id)
  await admin.from('agent_actions').update({ status: 'approved', output: result }).eq('id', approval.action_id)

  return Response.json({ status: 'approved', result })
})
```

Update the Next.js PATCH handler to call this Edge Function instead of doing the execution inline — reduces the Route Handler to a proxy.

***

## Phase 3 Completion Checklist

- [ ] All 5 marketplace tools implemented and callable
- [ ] All 5 payment tools implemented and callable
- [ ] Tools index updated — 24 tools total
- [ ] System prompt updated with marketplace and payment rules
- [ ] `executeApprovedTool` map updated with `bulk_price_update` and `process_refund`
- [ ] `approve-and-execute` Edge Function deployed and Route Handler updated to use it
- [ ] All 10 new Edge Functions present in `supabase/functions/`
- [ ] `merchant_integrations` table migrated
- [ ] `save-integration-secret` Edge Function deployed
- [ ] Integration settings page at `/settings/integrations` working
- [ ] `ListingHealthWidget` rendering on dashboard home
- [ ] "Ask MerchantMind to fix" button opens chat with pre-filled message
- [ ] New memory preference patterns for payment and marketplace added
- [ ] End-to-end test: "pull new orders from all marketplaces" → returns per-channel count
- [ ] End-to-end test: "check listing health on Shopee" → returns issues list
- [ ] End-to-end test: "generate payment link for order \#SHP-010 via Billplz" → returns URL
- [ ] End-to-end test: "refund RM50 for order \#SHP-010" → routes to approval queue
- [ ] End-to-end test: approve refund from queue → refund actually processed
- [ ] End-to-end test: full unpaid orders flow → links created and sent to customers
- [ ] End-to-end test: "update stock to 50 units for product \#PRD-001 on all marketplaces" → syncs to all three channels

<div align="center">⁂</div>

[^1]: PROJECT_OVERVIEW.md

