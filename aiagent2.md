<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Continue with phase 2

Here is the complete Phase 2 implementation plan.

***

# Phase 2 — Orders \& Logistics (Week 3–4)

**Goal:** The agent can manage the complete order-to-shipment workflow — updating order statuses, bulk processing, searching orders, checking delivery rates, booking Lalamove and EasyParcel shipments, and tracking them. The Approval Queue becomes fully functional with approve/reject execution.

**Deliverables at end of Phase 2:**

- 9 new tools implemented (3 order + 6 logistics)
- Approval Queue PATCH handler — approved actions execute the deferred tool call
- Fulfillment workflow test: "process all paid orders and book cheapest courier" runs end-to-end
- Supabase Realtime subscription on `agent_approvals` — dashboard badge updates live

***

## Step 1 — Complete the Remaining Order Tools

Phase 1 implemented `list_orders`, `get_order_details`, and `cancel_order`. Add the three remaining order tools to `packages/agent/src/tools/orders.ts`:

```typescript
// Append to existing orders.ts

export const updateOrderStatus = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Update the status of a single order. Use this to mark orders as processing, shipped, or completed. Do not use for cancellations — use cancel_order instead.',
    parameters: z.object({
      order_id:   z.string(),
      new_status: z.enum(['processing', 'shipped', 'completed']),
      note:       z.string().optional().describe('Optional internal note for the status change')
    }),
    execute: (input) =>
      executeWithGuard('update_order_status', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => edgeCall('update-order-status', { ...input, merchant_id: merchantId }))
  })

export const bulkMarkReady = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Mark multiple paid orders as ready to ship in one operation. Use this before booking bulk shipments.',
    parameters: z.object({
      order_ids:   z.array(z.string()).min(1).max(50)
                    .describe('Array of order IDs to mark as ready'),
      marketplace: z.enum(['shopee', 'lazada', 'tiktok', 'all']).optional()
                    .describe('Filter by marketplace — omit to mark across all channels')
    }),
    execute: (input) =>
      executeWithGuard('bulk_mark_ready', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => edgeCall('bulk-mark-ready', { ...input, merchant_id: merchantId }))
  })

export const searchOrders = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Full-text search across orders by customer name, email, product name, or order ID fragment.',
    parameters: z.object({
      query:       z.string().describe('Search term'),
      limit:       z.number().min(1).max(50).default(10)
    }),
    execute: (input) =>
      executeWithGuard('search_orders', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('search-orders', { ...input, merchant_id: merchantId }))
  })
```


***

## Step 2 — Logistics Tools

Create `packages/agent/src/tools/logistics.ts`:

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

// Tool 1: Check rates from both couriers — low risk
export const checkDeliveryRates = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Get delivery rate quotes from Lalamove and EasyParcel for one or more orders. Always call this before booking to find the cheapest option.',
    parameters: z.object({
      order_ids: z.array(z.string()).min(1)
                  .describe('One or more order IDs to get rates for'),
      couriers:  z.array(z.enum(['lalamove', 'easyparcel'])).default(['lalamove', 'easyparcel'])
                  .describe('Which couriers to get quotes from')
    }),
    execute: (input) =>
      executeWithGuard('check_delivery_rates', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('check-delivery-rates', { ...input, merchant_id: merchantId }))
  })

// Tool 2: Book Lalamove on-demand delivery — high risk
export const createLalamoveBooking = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Book an on-demand delivery via Lalamove for an order. Only use after checking rates. Best for same-day or urgent local deliveries.',
    parameters: z.object({
      order_id:     z.string(),
      service_type: z.enum(['MOTORCYCLE', 'CAR', 'VAN', 'TRUCK']).default('MOTORCYCLE'),
      priority_fee: z.number().optional()
                    .describe('Additional priority fee in RM — only include if merchant explicitly requested priority')
    }),
    execute: (input) =>
      executeWithGuard('create_lalamove_booking', input, {
        riskLevel:           'high',
        approvalTitle:       (i: any) =>
          `Book Lalamove for Order #${i.order_id}`,
        approvalDescription: (i: any) =>
          `Agent wants to book a Lalamove ${i.service_type} delivery for order #${i.order_id}.` +
          (i.priority_fee ? ` Priority fee: RM${i.priority_fee}.` : '')
      }, merchantId, sessionId,
        () => edgeCall('create-lalamove-booking', { ...input, merchant_id: merchantId }))
  })

// Tool 3: Book EasyParcel courier shipment — high risk
export const createEasyParcelShipment = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Book a courier shipment via EasyParcel for an order. Best for standard parcel deliveries. Only use after checking rates.',
    parameters: z.object({
      order_id:     z.string(),
      courier_id:   z.string()
                    .describe('Courier code returned by check_delivery_rates e.g. "GDEX", "POSLAJU", "JANDT"'),
      weight_kg:    z.number().min(0.1)
                    .describe('Parcel weight in kilograms'),
      dimensions:   z.object({
        length_cm: z.number(),
        width_cm:  z.number(),
        height_cm: z.number()
      }).optional()
    }),
    execute: (input) =>
      executeWithGuard('create_easyparcel_shipment', input, {
        riskLevel:           'high',
        approvalTitle:       (i: any) =>
          `Book EasyParcel Shipment for Order #${i.order_id}`,
        approvalDescription: (i: any) =>
          `Agent wants to book ${i.courier_id} via EasyParcel for order #${i.order_id} (${i.weight_kg}kg).`
      }, merchantId, sessionId,
        () => edgeCall('create-easyparcel-shipment', { ...input, merchant_id: merchantId }))
  })

// Tool 4: Get tracking status — low risk
export const getShipmentTracking = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Get real-time tracking status for one or more shipments by order ID or tracking number.',
    parameters: z.object({
      identifiers: z.array(z.string()).min(1)
                    .describe('Order IDs or tracking numbers'),
      id_type:     z.enum(['order_id', 'tracking_number']).default('order_id')
    }),
    execute: (input) =>
      executeWithGuard('get_shipment_tracking', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('get-shipment-tracking', { ...input, merchant_id: merchantId }))
  })

// Tool 5: Cancel shipment — high risk
export const cancelShipment = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Cancel an active shipment booking. Only possible before the courier picks up the parcel.',
    parameters: z.object({
      order_id: z.string(),
      reason:   z.string()
    }),
    execute: (input) =>
      executeWithGuard('cancel_shipment', input, {
        riskLevel:           'high',
        approvalTitle:       (i: any) => `Cancel Shipment for Order #${i.order_id}`,
        approvalDescription: (i: any) =>
          `Agent wants to cancel the active shipment for order #${i.order_id}. Reason: ${i.reason}`
      }, merchantId, sessionId,
        () => edgeCall('cancel-shipment', { ...input, merchant_id: merchantId }))
  })

// Tool 6: Fulfillment summary — low risk
export const getFulfillmentSummary = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Get aggregated fulfillment metrics: total shipments, on-time rate, courier breakdown, and average delivery cost for a period.',
    parameters: z.object({
      period: z.enum(['today', 'this_week', 'last_week', 'this_month', 'last_month'])
    }),
    execute: (input) =>
      executeWithGuard('get_fulfillment_summary', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('fulfillment-summary', { ...input, merchant_id: merchantId }))
  })
```


***

## Step 3 — Update Tools Index

**`packages/agent/src/tools/index.ts`** — add the new tools:

```typescript
import { listOrders, getOrderDetails, cancelOrder,
         updateOrderStatus, bulkMarkReady, searchOrders } from './orders'
import { getSalesSummary }   from './analytics'
import { searchKnowledgeBase } from './knowledge'
import {
  checkDeliveryRates,
  createLalamoveBooking,
  createEasyParcelShipment,
  getShipmentTracking,
  cancelShipment,
  getFulfillmentSummary
} from './logistics'

export const buildTools = (merchantId: string, sessionId: string) => ({
  // Orders
  list_orders:                listOrders(merchantId, sessionId),
  get_order_details:          getOrderDetails(merchantId, sessionId),
  cancel_order:               cancelOrder(merchantId, sessionId),
  update_order_status:        updateOrderStatus(merchantId, sessionId),
  bulk_mark_ready:            bulkMarkReady(merchantId, sessionId),
  search_orders:              searchOrders(merchantId, sessionId),

  // Logistics
  check_delivery_rates:       checkDeliveryRates(merchantId, sessionId),
  create_lalamove_booking:    createLalamoveBooking(merchantId, sessionId),
  create_easyparcel_shipment: createEasyParcelShipment(merchantId, sessionId),
  get_shipment_tracking:      getShipmentTracking(merchantId, sessionId),
  cancel_shipment:            cancelShipment(merchantId, sessionId),
  get_fulfillment_summary:    getFulfillmentSummary(merchantId, sessionId),

  // Knowledge
  search_knowledge_base:      searchKnowledgeBase,

  // Analytics
  get_sales_summary:          getSalesSummary(merchantId, sessionId)
})
```


***

## Step 4 — Update System Prompt

Extend the system prompt in `packages/agent/src/prompts/system.ts` with logistics-specific behaviour rules:

```typescript
export function buildSystemPrompt(merchantName: string): string {
  return `
You are MerchantMind, an autonomous operations assistant for ${merchantName}'s e-commerce business.

## Capabilities
- Manage orders: list, search, update status, bulk mark ready, cancel
- Logistics: check delivery rates, book Lalamove or EasyParcel, track shipments, cancel shipments
- Sales analytics and fulfillment summaries
- Malaysia LHDN e-invoicing regulatory advice (use search_knowledge_base)

## Behaviour rules
- Lead with the answer, then supporting detail.
- Before any action, state what you are about to do.
- After completing a task, suggest the logical next step.
- For e-invoice questions, always cite source document and section.
- Never invent order IDs, amounts, or tracking numbers — retrieve from tools.
- If an action is sent for approval, tell the merchant what is pending and where to approve.
- Keep responses under 200 words unless full detail is requested.

## Logistics decision rules
- ALWAYS call check_delivery_rates before booking any shipment.
- Default to EasyParcel for standard parcels, Lalamove for same-day urgent deliveries.
- When booking in bulk, group orders by courier to minimise API calls.
- If a rate check returns no results, tell the merchant and ask them to verify the delivery address.
- Never book a shipment for an order that is not in 'paid' or 'processing' status.

## Order workflow rules
- Call bulk_mark_ready before booking bulk shipments.
- Use update_order_status to mark orders 'shipped' after a successful booking.
- Never cancel an order without explicit merchant confirmation of the order ID.

## Formatting
- Bullet points for lists of orders or shipments
- RM prefix for currency, kg for weights
- DD/MM/YYYY for dates
- ✅ success  ⚠️ warning  ❌ error

Today: ${new Date().toLocaleDateString('en-MY', { dateStyle: 'full' })}
`.trim()
}
```


***

## Step 5 — Complete the Approval Queue

Phase 1 built the Approvals UI page but left the PATCH handler as a placeholder. This is the most important step in Phase 2 — approvals need to **actually execute the deferred tool call** when the merchant approves.

**`apps/dashboard/app/api/agent/approvals/[id]/route.ts`:**

```typescript
import { createClient }         from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { buildTools }           from '@repo/agent'
import { AwaitingApprovalError } from '@repo/agent/src/middleware/executor'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { action, reject_reason }
    : { action: 'approve' | 'reject', reject_reason?: string } = await req.json()

  // Fetch the approval — RLS ensures it belongs to this merchant
  const { data: approval, error } = await supabase
    .from('agent_approvals')
    .select('*, agent_actions(session_id)')
    .eq('id', params.id)
    .eq('status', 'pending')
    .single()

  if (error || !approval) {
    return Response.json({ error: 'Approval not found' }, { status: 404 })
  }

  const admin = createAdmin(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  if (action === 'reject') {
    await admin.from('agent_approvals').update({
      status:        'rejected',
      approved_by:   user.id,
      reject_reason: reject_reason ?? 'Rejected by merchant',
      resolved_at:   new Date().toISOString()
    }).eq('id', params.id)

    await admin.from('agent_actions').update({ status: 'rejected' })
      .eq('id', approval.action_id)

    return Response.json({ status: 'rejected' })
  }

  // APPROVE — execute the deferred tool call
  try {
    const sessionId = approval.agent_actions?.session_id
    const tools = buildTools(user.id, sessionId)
    const tool = tools[approval.tool_name as keyof typeof tools]

    if (!tool) throw new Error(`Unknown tool: ${approval.tool_name}`)

    // Call the tool's execute function directly — bypassing HITL since approved
    // We need to call the underlying edge function, not go through executeWithGuard again
    const result = await executeApprovedTool(
      approval.tool_name,
      approval.tool_input,
      user.id
    )

    // Mark as approved and store output
    await admin.from('agent_approvals').update({
      status:      'approved',
      approved_by: user.id,
      resolved_at: new Date().toISOString()
    }).eq('id', params.id)

    await admin.from('agent_actions').update({
      status: 'approved',
      output: result
    }).eq('id', approval.action_id)

    return Response.json({ status: 'approved', result })

  } catch (err) {
    await admin.from('agent_actions').update({
      status: 'failed',
      output: { error: String(err) }
    }).eq('id', approval.action_id)

    return Response.json({ error: String(err) }, { status: 500 })
  }
}

// Direct edge function caller for approved actions (no HITL wrapper)
async function executeApprovedTool(toolName: string, input: unknown, merchantId: string) {
  const edgeFunctionMap: Record<string, string> = {
    cancel_order:               'cancel-order',
    create_lalamove_booking:    'create-lalamove-booking',
    create_easyparcel_shipment: 'create-easyparcel-shipment',
    cancel_shipment:            'cancel-shipment',
    bulk_mark_ready:            'bulk-mark-ready'
  }

  const fn = edgeFunctionMap[toolName]
  if (!fn) throw new Error(`No edge function mapped for tool: ${toolName}`)

  const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/${fn}`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type':  'application/json'
    },
    body: JSON.stringify({ ...(input as object), merchant_id: merchantId })
  })

  if (!res.ok) throw new Error(`Edge function ${fn} returned ${res.status}`)
  return res.json()
}
```


***

## Step 6 — Upgrade Approvals UI

Update the approvals page from Phase 1 to be a full Client Component with live approval/rejection, inline feedback, and a badge count in the nav.

**`apps/dashboard/components/agent/ApprovalCard.tsx`:**

```tsx
'use client'

import { useState } from 'react'

interface Approval {
  id:          string
  title:       string
  description: string
  risk_level:  string
  tool_name:   string
  created_at:  string
}

interface Props {
  approval:  Approval
  onResolve: (id: string) => void
}

export function ApprovalCard({ approval, onResolve }: Props) {
  const [loading,      setLoading]      = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject,   setShowReject]   = useState(false)
  const [result,       setResult]       = useState<'approved' | 'rejected' | null>(null)

  async function resolve(action: 'approve' | 'reject') {
    setLoading(true)
    const res = await fetch(`/api/agent/approvals/${approval.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        action,
        reject_reason: rejectReason || undefined
      })
    })
    setLoading(false)
    if (res.ok) {
      setResult(action === 'approve' ? 'approved' : 'rejected')
      setTimeout(() => onResolve(approval.id), 1200)
    }
  }

  if (result) {
    return (
      <div className={`border rounded-xl p-4 text-sm font-medium
        ${result === 'approved' ? 'text-green-700 bg-green-50 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800'
                                : 'text-muted-foreground bg-muted'}`}>
        {result === 'approved' ? '✅ Approved and executed' : '❌ Rejected'}
      </div>
    )
  }

  return (
    <div className="border rounded-xl p-4 space-y-3 bg-background">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">{approval.title}</p>
          <p className="text-xs text-muted-foreground">{approval.description}</p>
        </div>
        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium
                         bg-yellow-100 text-yellow-800
                         dark:bg-yellow-900 dark:text-yellow-200">
          ⚠️ {approval.risk_level}
        </span>
      </div>

      <div className="text-xs text-muted-foreground font-mono">
        Tool: {approval.tool_name} ·{' '}
        {new Date(approval.created_at).toLocaleString('en-MY')}
      </div>

      {showReject ? (
        <div className="space-y-2">
          <input
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (optional)"
            className="w-full text-sm border rounded-lg px-3 py-2 bg-background
                       focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={() => resolve('reject')}
              disabled={loading}
              className="flex-1 text-sm py-2 rounded-lg border border-destructive
                         text-destructive hover:bg-destructive hover:text-destructive-foreground
                         transition-colors disabled:opacity-50"
            >
              Confirm Reject
            </button>
            <button
              onClick={() => setShowReject(false)}
              className="text-sm px-4 py-2 rounded-lg border hover:bg-muted transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => resolve('approve')}
            disabled={loading}
            className="flex-1 text-sm py-2 rounded-lg bg-primary text-primary-foreground
                       hover:bg-primary/90 transition-colors disabled:opacity-50 font-medium"
          >
            {loading ? 'Executing…' : 'Approve'}
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={loading}
            className="flex-1 text-sm py-2 rounded-lg border hover:bg-muted
                       transition-colors disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}
```

**`apps/dashboard/app/(dashboard)/agent/approvals/page.tsx`** (full rewrite):

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ApprovalCard } from '@/components/agent/ApprovalCard'
import { createClient } from '@/lib/supabase/client'

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<any[]>([])
  const supabase = createClient()

  async function fetchApprovals() {
    const { data } = await supabase
      .from('agent_approvals')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setApprovals(data ?? [])
  }

  useEffect(() => {
    fetchApprovals()

    // Realtime subscription — badge + list update live
    const channel = supabase
      .channel('approvals')
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'agent_approvals'
      }, () => fetchApprovals())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pending Approvals</h1>
        {approvals.length > 0 && (
          <span className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900
                           dark:text-yellow-200 px-2.5 py-1 rounded-full font-semibold">
            {approvals.length} pending
          </span>
        )}
      </div>

      {approvals.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          <p className="text-2xl mb-2">✅</p>
          <p>No pending approvals</p>
        </div>
      ) : (
        approvals.map(a => (
          <ApprovalCard
            key={a.id}
            approval={a}
            onResolve={(id) => setApprovals(prev => prev.filter(x => x.id !== id))}
          />
        ))
      )}
    </div>
  )
}
```


***

## Step 7 — Approval Badge in Dashboard Nav

Add a live badge count to the sidebar navigation link so merchants know there are pending approvals without visiting the page:

**`apps/dashboard/components/nav/ApprovalsBadge.tsx`:**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function ApprovalsBadge() {
  const [count, setCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    async function fetchCount() {
      const { count: c } = await supabase
        .from('agent_approvals')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      setCount(c ?? 0)
    }

    fetchCount()

    const channel = supabase
      .channel('approvals-badge')
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'agent_approvals'
      }, fetchCount)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  if (count === 0) return null

  return (
    <span className="ml-auto text-xs bg-yellow-500 text-white
                     rounded-full px-1.5 py-0.5 font-semibold min-w-[1.25rem]
                     text-center leading-tight">
      {count}
    </span>
  )
}
```

Add `<ApprovalsBadge />` next to the "Approvals" link in your existing dashboard sidebar component.

***

## Step 8 — Activity Feed Component

Add a live feed of recent agent actions to the dashboard home page — gives merchants visibility into what the agent has been doing.

**`apps/dashboard/components/agent/AgentActivityFeed.tsx`:**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Action {
  id:          string
  tool_name:   string
  status:      string
  risk_level:  string
  input:       Record<string, unknown>
  executed_at: string
}

const STATUS_ICONS: Record<string, string> = {
  executed:         '✅',
  pending_approval: '⏳',
  approved:         '✅',
  rejected:         '❌',
  failed:           '❌'
}

export function AgentActivityFeed({ limit = 10 }: { limit?: number }) {
  const [actions, setActions] = useState<Action[]>([])
  const supabase = createClient()

  useEffect(() => {
    async function fetchActions() {
      const { data } = await supabase
        .from('agent_actions')
        .select('id, tool_name, status, risk_level, input, executed_at')
        .order('executed_at', { ascending: false })
        .limit(limit)
      setActions(data ?? [])
    }

    fetchActions()

    const channel = supabase
      .channel('activity-feed')
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'agent_actions'
      }, () => fetchActions())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [limit])

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Recent Agent Activity
      </h3>
      {actions.length === 0 && (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      )}
      {actions.map(a => (
        <div key={a.id}
             className="flex items-start gap-3 text-sm py-2 border-b last:border-0">
          <span className="text-base leading-none mt-0.5">
            {STATUS_ICONS[a.status] ?? '•'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {a.tool_name.replace(/_/g, ' ')}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(a.executed_at).toLocaleString('en-MY')}
            </p>
          </div>
          <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0
            ${a.status === 'executed' || a.status === 'approved'
              ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
              : a.status === 'pending_approval'
              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300'
              : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'}`}>
            {a.status.replace(/_/g, ' ')}
          </span>
        </div>
      ))}
    </div>
  )
}
```


***

## Step 9 — Supabase Edge Functions Required

Ensure these Edge Functions exist in `supabase/functions/`. For each one that doesn't exist yet, create it as a stub that calls your existing DB logic from `packages/db`:

**New functions needed for Phase 2:**


| Function | Wraps |
| :-- | :-- |
| `update-order-status` | Update `orders` table status + log |
| `bulk-mark-ready` | Batch update orders to `processing` |
| `search-orders` | Full-text search on `orders` table |
| `check-delivery-rates` | Call Lalamove + EasyParcel rate APIs in parallel |
| `create-lalamove-booking` | Lalamove Order Create API |
| `create-easyparcel-shipment` | EasyParcel shipment booking API |
| `get-shipment-tracking` | Query tracking from both providers |
| `cancel-shipment` | Cancel via Lalamove or EasyParcel API |
| `fulfillment-summary` | Aggregate from `shipments` table |

Your project already has Lalamove and EasyParcel integration logic in `packages/integrations`  — the Edge Functions are thin wrappers around that existing code.[^1]

***

## Step 10 — Update Orchestrator `onFinish` for Long-term Memory

Now that the agent is doing real work, start seeding long-term memory with preferences it discovers. Add this to the `onFinish` callback in `packages/agent/src/orchestrator.ts`:

```typescript
onFinish: async ({ text, steps }) => {
  // Persist messages
  await saveMessages(sessionId, merchantId, [
    { role: 'user',      content: newMessage },
    { role: 'assistant', content: text }
  ])
  await touchSession(sessionId)

  // Detect and save preferences from logistics decisions
  const preferencePatterns = [
    { regex: /prefer(red)? easyparcel/i,  fact: 'Merchant prefers EasyParcel for standard shipments' },
    { regex: /prefer(red)? lalamove/i,    fact: 'Merchant prefers Lalamove for urgent deliveries' },
    { regex: /always use poslaju/i,       fact: 'Merchant always uses Pos Laju courier' }
  ]

  for (const { regex, fact } of preferencePatterns) {
    if (regex.test(newMessage) || regex.test(text)) {
      await saveLongTermMemory(merchantId, fact, 'preference')
      break
    }
  }
}
```

Add `saveLongTermMemory` to `packages/agent/src/memory/long-term.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import { google }       from '@ai-sdk/google'
import { embed }        from 'ai'

export async function saveLongTermMemory(
  merchantId: string,
  content:    string,
  type:       'fact' | 'preference' | 'pattern'
) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { embedding } = await embed({
    model: google.textEmbeddingModel('text-embedding-004'),
    value: content
  })

  await supabase.from('agent_memory').insert({
    merchant_id: merchantId,
    type,
    content,
    embedding
  })
}
```


***

## Phase 2 Completion Checklist

- [ ] `update_order_status`, `bulk_mark_ready`, `search_orders` tools implemented
- [ ] All 6 logistics tools implemented and callable
- [ ] Tools index updated — 14 tools total now registered
- [ ] System prompt updated with logistics decision rules
- [ ] Approval PATCH handler executes deferred tool calls on approve
- [ ] Approval PATCH handler records rejection reason and updates action status
- [ ] `ApprovalCard` shows approve/reject with confirmation flow
- [ ] Approvals page uses Realtime subscription — updates without refresh
- [ ] `ApprovalsBadge` shows live count in dashboard sidebar nav
- [ ] `AgentActivityFeed` live on dashboard home via Realtime
- [ ] All 9 new Edge Functions present in `supabase/functions/`
- [ ] Long-term memory saving works — preference stored after courier choice
- [ ] End-to-end test: "check rates for order \#SHP-001" → returns Lalamove + EasyParcel quotes
- [ ] End-to-end test: "book the cheapest courier for order \#SHP-001" → routes to approval queue
- [ ] End-to-end test: approve from Approval Queue → shipment actually created
- [ ] End-to-end test: "process all paid orders and book EasyParcel" → bulk flow completes
- [ ] End-to-end test: "track order \#SHP-001" → returns current tracking status

<div align="center">⁂</div>

[^1]: PROJECT_OVERVIEW.md

