<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Continue phase 5

Here is the complete Phase 5 implementation plan.

***

# Phase 5 — Proactive Intelligence \& Automation (Week 9–10)

**Goal:** The agent stops being purely reactive (answering questions) and becomes proactive — running scheduled routines, detecting anomalies, surfacing insights the merchant never thought to ask for, and executing multi-step playbooks autonomously on a schedule. This is the phase where MerchantMind becomes a genuine employee rather than a chatbot.

**Deliverables at end of Phase 5:**

- 8 new tools implemented (3 analytics + 5 automation)
- Scheduled agent runs via Supabase cron — morning briefing, daily invoice sweep, stock alerts
- Anomaly detection engine running every 15 minutes
- Playbook system — reusable multi-step workflows the merchant defines once and the agent executes on schedule
- Agent-initiated notifications pushed to dashboard without merchant prompting
- Full long-term memory retrieval wired into every agent run
- Agent session summary written on session close

***

## Step 1 — Advanced Analytics Tools

Create `packages/agent/src/tools/analytics-advanced.ts`:

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
    execute: (input) =>
      executeWithGuard('compare_performance', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('compare-performance', { ...input, merchant_id: merchantId }))
  })

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
    execute: (input) =>
      executeWithGuard('detect_anomalies', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('detect-anomalies', { ...input, merchant_id: merchantId }))
  })

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
    execute: (input) =>
      executeWithGuard('generate_business_report', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('generate-business-report', { ...input, merchant_id: merchantId }))
  })
```


***

## Step 2 — Automation \& Playbook Tools

Create `packages/agent/src/tools/automation.ts`:

```typescript
import { tool } from 'ai'
import { z } from 'zod'
import { executeWithGuard } from '../middleware/executor'
import { createClient }     from '@supabase/supabase-js'

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

// Tool 1: Save a playbook — low risk
export const savePlaybook = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Save a reusable multi-step workflow as a named playbook. The agent will execute this playbook on demand or on a schedule. Use this when the merchant wants to automate a recurring task.',
    parameters: z.object({
      name:        z.string().describe('Short descriptive name e.g. "Morning order briefing" or "End-of-day invoice sweep"'),
      description: z.string().describe('What this playbook does in plain language'),
      steps:       z.array(z.string()).min(1).max(10)
                   .describe('Ordered list of instructions — each step is a plain-English instruction the agent will execute'),
      schedule:    z.object({
        type:     z.enum(['manual', 'daily', 'weekly', 'monthly']),
        time:     z.string().optional().describe('24h time in Asia/Kuala_Lumpur e.g. "08:00"'),
        day:      z.number().min(0).max(6).optional().describe('Day of week 0=Sun for weekly schedules'),
        day_of_month: z.number().min(1).max(28).optional().describe('Day of month for monthly schedules')
      })
    }),
    execute: async (input) => {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data } = await supabase
        .from('agent_playbooks')
        .upsert({
          merchant_id: merchantId,
          name:        input.name,
          description: input.description,
          steps:       input.steps,
          schedule:    input.schedule,
          is_active:   true
        }, { onConflict: 'merchant_id,name' })
        .select('id')
        .single()
      return { playbook_id: data?.id, name: input.name, saved: true }
    }
  })

// Tool 2: Run a playbook immediately — medium risk
export const runPlaybook = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Execute a saved playbook immediately. The agent will run through each step in sequence.',
    parameters: z.object({
      playbook_name: z.string().describe('The exact playbook name as saved'),
      context:       z.string().optional().describe('Optional context or overrides for this run e.g. "only process Shopee orders"')
    }),
    execute: (input) =>
      executeWithGuard('run_playbook', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => edgeCall('run-playbook', { ...input, merchant_id: merchantId, session_id: sessionId }))
  })

// Tool 3: List active playbooks — low risk
export const listPlaybooks = (merchantId: string, sessionId: string) =>
  tool({
    description: 'List all saved playbooks for this merchant, including their schedule and last run status.',
    parameters: z.object({
      status: z.enum(['active', 'paused', 'all']).default('active')
    }),
    execute: async (input) => {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const query = supabase
        .from('agent_playbooks')
        .select('id, name, description, schedule, is_active, last_run_at, last_run_status')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })

      if (input.status !== 'all') {
        query.eq('is_active', input.status === 'active')
      }

      const { data } = await query
      return data ?? []
    }
  })

// Tool 4: Push a proactive alert to the dashboard — low risk
export const pushDashboardAlert = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Push a proactive alert or insight card to the merchant dashboard. Use this during scheduled runs to surface findings without waiting for the merchant to ask.',
    parameters: z.object({
      title:    z.string().describe('Short alert title e.g. "Revenue down 23% today"'),
      body:     z.string().describe('Full explanation of the alert and recommended action'),
      severity: z.enum(['info', 'warning', 'critical']),
      category: z.enum(['revenue', 'orders', 'logistics', 'stock', 'payments', 'einvoice', 'crm']),
      action:   z.object({
        label:   z.string().describe('CTA button label e.g. "View orders" or "Fix now"'),
        message: z.string().describe('Message to pre-fill in agent chat when merchant clicks the CTA')
      }).optional()
    }),
    execute: async (input) => {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data } = await supabase
        .from('agent_alerts')
        .insert({
          merchant_id: merchantId,
          session_id:  sessionId,
          ...input,
          is_read:     false
        })
        .select('id')
        .single()
      return { alert_id: data?.id, pushed: true }
    }
  })

// Tool 5: Get merchant context snapshot — low risk
export const getMerchantSnapshot = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Get a full context snapshot of current business state: pending orders, unshipped items, unpaid invoices, low stock, and pending approvals. Use at the start of any scheduled run.',
    parameters: z.object({
      include: z.array(z.enum([
        'pending_orders', 'unshipped_orders', 'pending_approvals',
        'unpaid_invoices', 'low_stock', 'failed_payments', 'all'
      ])).default(['all'])
    }),
    execute: (input) =>
      executeWithGuard('get_merchant_snapshot', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('merchant-snapshot', { ...input, merchant_id: merchantId }))
  })
```


***

## Step 3 — Update Tools Index

**`packages/agent/src/tools/index.ts`** — final complete version:

```typescript
import { listOrders, getOrderDetails, cancelOrder,
         updateOrderStatus, bulkMarkReady, searchOrders }  from './orders'
import { getSalesSummary }          from './analytics'
import { comparePerformance, detectAnomalies,
         generateBusinessReport }   from './analytics-advanced'
import { searchKnowledgeBase }      from './knowledge'
import { checkDeliveryRates, createLalamoveBooking,
         createEasyParcelShipment, getShipmentTracking,
         cancelShipment, getFulfillmentSummary }           from './logistics'
import { syncProductListing, updateStockLevel,
         pullMarketplaceOrders, getListingHealth,
         bulkPriceUpdate }          from './marketplace'
import { createPaymentLink, verifyPaymentStatus,
         processRefund, getPaymentReport,
         listUnpaidOrders }         from './payments'
import { listPendingInvoices, generateEinvoice,
         batchSubmitInvoices, checkLhdnSubmissionStatus,
         generateConsolidatedInvoice }                     from './einvoice'
import { getCustomerProfile, getCustomerSegments,
         awardLoyaltyPoints, processPointRedemption,
         sendLoyaltyNotification }  from './crm'
import { savePlaybook, runPlaybook, listPlaybooks,
         pushDashboardAlert, getMerchantSnapshot }         from './automation'

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

  // Analytics (4)
  get_sales_summary:              getSalesSummary(merchantId, sessionId),
  compare_performance:            comparePerformance(merchantId, sessionId),
  detect_anomalies:               detectAnomalies(merchantId, sessionId),
  generate_business_report:       generateBusinessReport(merchantId, sessionId),

  // Automation (5)
  save_playbook:                  savePlaybook(merchantId, sessionId),
  run_playbook:                   runPlaybook(merchantId, sessionId),
  list_playbooks:                 listPlaybooks(merchantId, sessionId),
  push_dashboard_alert:           pushDashboardAlert(merchantId, sessionId),
  get_merchant_snapshot:          getMerchantSnapshot(merchantId, sessionId),

  // Knowledge (1)
  search_knowledge_base:          searchKnowledgeBase
})
```

Total: **42 tools** registered.

***

## Step 4 — Database Schema Additions

```sql
-- 1. Playbooks
create table agent_playbooks (
  id              uuid primary key default gen_random_uuid(),
  merchant_id     uuid not null references auth.users(id),
  name            text not null,
  description     text,
  steps           text[] not null,       -- ordered plain-English instructions
  schedule        jsonb not null,        -- { type, time, day, day_of_month }
  is_active       boolean default true,
  last_run_at     timestamptz,
  last_run_status text,                  -- 'success' | 'partial' | 'failed'
  last_run_summary text,
  created_at      timestamptz default now(),
  unique (merchant_id, name)
);

-- 2. Proactive alerts
create table agent_alerts (
  id          uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id),
  session_id  uuid references agent_sessions(id),
  title       text not null,
  body        text not null,
  severity    text not null,            -- 'info' | 'warning' | 'critical'
  category    text not null,
  action      jsonb,                    -- { label, message }
  is_read     boolean default false,
  created_at  timestamptz default now()
);

-- 3. Scheduled run log
create table agent_scheduled_runs (
  id           uuid primary key default gen_random_uuid(),
  merchant_id  uuid not null references auth.users(id),
  playbook_id  uuid references agent_playbooks(id),
  run_type     text not null,           -- 'playbook' | 'anomaly_scan' | 'morning_briefing' | 'invoice_sweep'
  status       text not null default 'running',
  -- 'running' | 'completed' | 'failed'
  summary      text,
  alerts_pushed int default 0,
  actions_taken int default 0,
  started_at   timestamptz default now(),
  completed_at timestamptz
);

-- RLS
alter table agent_playbooks      enable row level security;
alter table agent_alerts         enable row level security;
alter table agent_scheduled_runs enable row level security;

create policy "own playbooks"      on agent_playbooks      for all using (merchant_id = auth.uid());
create policy "own alerts"         on agent_alerts         for all using (merchant_id = auth.uid());
create policy "own scheduled runs" on agent_scheduled_runs for all using (merchant_id = auth.uid());

-- Indexes
create index on agent_playbooks(merchant_id, is_active);
create index on agent_alerts(merchant_id, is_read, created_at desc);
create index on agent_scheduled_runs(merchant_id, started_at desc);
```


***

## Step 5 — Scheduled Agent Runner

The core of Phase 5 is a dedicated Supabase Edge Function that runs the agent on a schedule, completely without merchant input. It uses the same `runAgent` orchestrator as the chat route but with a special system prompt for autonomous runs.

**`supabase/functions/run-scheduled-agent/index.ts`:**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { streamText }   from 'https://esm.sh/ai'
import { google }       from 'https://esm.sh/@ai-sdk/google'

type RunType = 'morning_briefing' | 'anomaly_scan' | 'invoice_sweep' | 'playbook'

interface RunPayload {
  merchant_id: string
  run_type:    RunType
  playbook_id?: string
}

Deno.serve(async (req) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const payload: RunPayload = await req.json()
  const { merchant_id, run_type, playbook_id } = payload

  // Create a scheduled run log entry
  const { data: run } = await admin
    .from('agent_scheduled_runs')
    .insert({ merchant_id, run_type, playbook_id: playbook_id ?? null })
    .select('id')
    .single()
  const runId = run!.id

  // Create a new agent session for this scheduled run
  const { data: session } = await admin
    .from('agent_sessions')
    .insert({
      merchant_id,
      title: `Scheduled: ${run_type.replace(/_/g, ' ')}`,
      status: 'active'
    })
    .select('id')
    .single()
  const sessionId = session!.id

  // Get merchant name
  const { data: profile } = await admin
    .from('profiles')
    .select('business_name')
    .eq('id', merchant_id)
    .single()
  const merchantName = profile?.business_name ?? 'Merchant'

  // Get the instruction for this run type
  const instruction = await buildRunInstruction(run_type, playbook_id, merchant_id, admin)

  try {
    // Import tools — built for this merchant+session context
    const { buildTools } = await import('../../packages/agent/src/tools/index.ts')
    const tools = buildTools(merchant_id, sessionId)

    let alertsPushed = 0
    let actionsTaken = 0
    let summary = ''

    const result = await streamText({
      model: google('gemini-3.1-flash-lite-preview'),
      system: buildScheduledRunSystemPrompt(merchantName, run_type),
      messages: [{ role: 'user', content: instruction }],
      tools,
      maxSteps: 25,   // higher limit for autonomous multi-step runs
      onStepFinish: ({ toolResults }) => {
        for (const r of toolResults ?? []) {
          if (r.toolName === 'push_dashboard_alert') alertsPushed++
          else actionsTaken++
        }
      },
      onFinish: async ({ text }) => {
        summary = text
        await admin.from('agent_sessions').update({
          status:     'completed',
          summary:    text.slice(0, 500),
          updated_at: new Date().toISOString()
        }).eq('id', sessionId)
      }
    })

    // Consume the stream fully (scheduled runs don't stream to a client)
    for await (const _ of result.textStream) {}

    // Update run log
    await admin.from('agent_scheduled_runs').update({
      status:       'completed',
      summary:      summary.slice(0, 500),
      alerts_pushed: alertsPushed,
      actions_taken: actionsTaken,
      completed_at: new Date().toISOString()
    }).eq('id', runId)

    // Update playbook last run info
    if (playbook_id) {
      await admin.from('agent_playbooks').update({
        last_run_at:      new Date().toISOString(),
        last_run_status:  'success',
        last_run_summary: summary.slice(0, 300)
      }).eq('id', playbook_id)
    }

    return new Response(JSON.stringify({ success: true, run_id: runId }))

  } catch (err) {
    await admin.from('agent_scheduled_runs').update({
      status:       'failed',
      summary:      String(err),
      completed_at: new Date().toISOString()
    }).eq('id', runId)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})

// Build the instruction message for each run type
async function buildRunInstruction(
  runType:    RunType,
  playbookId: string | undefined,
  merchantId: string,
  admin:      ReturnType<typeof createClient>
): Promise<string> {
  if (runType === 'morning_briefing') {
    return `Run the morning briefing routine:
1. Call get_merchant_snapshot to assess current business state
2. Call get_sales_summary for yesterday and compare to the same day last week
3. Call list_unpaid_orders older_than_hours=12
4. Call detect_anomalies for the last 24 hours
5. For each significant finding, call push_dashboard_alert with appropriate severity
6. Summarise everything in 150 words or less`
  }

  if (runType === 'anomaly_scan') {
    return `Run an anomaly detection scan:
1. Call detect_anomalies for the last 2 hours across all categories
2. For any anomaly with high severity, call push_dashboard_alert immediately
3. For medium severity anomalies, group them into a single summary alert
4. Skip low severity unless there are 5 or more of the same type
5. Return total anomalies found and alerts pushed`
  }

  if (runType === 'invoice_sweep') {
    return `Run the end-of-day e-invoice sweep:
1. Call list_pending_invoices for today's completed orders
2. If there are individual (B2B) invoices pending, push a dashboard alert asking merchant to review and submit
3. Count eligible B2C orders for consolidated invoicing
4. Push a summary alert with counts and a CTA to submit
5. Do NOT submit invoices automatically — always route to approval`
  }

  if (runType === 'playbook' && playbookId) {
    const { data: playbook } = await admin
      .from('agent_playbooks')
      .select('name, steps')
      .eq('id', playbookId)
      .single()

    const steps = (playbook?.steps ?? [])
      .map((s: string, i: number) => `${i + 1}. ${s}`)
      .join('\n')

    return `Execute the "${playbook?.name}" playbook:\n${steps}`
  }

  return 'Run a general merchant health check and push any important alerts.'
}

// Separate system prompt for scheduled/autonomous runs
function buildScheduledRunSystemPrompt(merchantName: string, runType: string): string {
  return `
You are MerchantMind running an automated scheduled task for ${merchantName}.
This is a background run — no merchant is watching in real time.

## Behaviour rules for scheduled runs
- Execute each step systematically without asking for confirmation.
- Use push_dashboard_alert to surface all findings to the merchant.
- For high-risk actions (shipment bookings, invoice submissions), push a critical alert
  with a CTA instead of executing — the merchant must approve from the dashboard.
- Be efficient: complete the full task in as few tool calls as possible.
- Write a concise summary at the end: what you found, what you did, what needs attention.
- Do not be conversational — this summary is logged, not displayed in chat.

Run type: ${runType}
Time: ${new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}
`.trim()
}
```


***

## Step 6 — Register Cron Schedules

**`supabase/config.toml`** — add all scheduled agent runs:

```toml
# Existing from Phase 4
[functions.poll-lhdn-status]
schedule = "*/3 * * * *"

# Phase 5 — Scheduled agent runs

# Morning briefing: every day at 8:00 AM MYT (00:00 UTC)
[functions.trigger-morning-briefing]
schedule = "0 0 * * *"

# Anomaly scan: every 15 minutes
[functions.trigger-anomaly-scan]
schedule = "*/15 * * * *"

# End-of-day invoice sweep: every day at 6:00 PM MYT (10:00 UTC)
[functions.trigger-invoice-sweep]
schedule = "0 10 * * *"

# Playbook runner: every minute — checks for due playbooks and runs them
[functions.trigger-playbook-runner]
schedule = "* * * * *"
```

Each trigger function is a thin dispatcher that queries active merchants and fires `run-scheduled-agent` per merchant:

**`supabase/functions/trigger-morning-briefing/index.ts`:**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Get all merchants with active agent sessions in the last 7 days
  // (only run for engaged merchants — skip dormant accounts)
  const { data: merchants } = await admin
    .from('agent_sessions')
    .select('merchant_id')
    .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('merchant_id')

  // Deduplicate
  const uniqueMerchants = [...new Set((merchants ?? []).map(m => m.merchant_id))]

  // Fire scheduled run for each merchant
  await Promise.allSettled(
    uniqueMerchants.map(merchantId =>
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/run-scheduled-agent`, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type':  'application/json'
        },
        body: JSON.stringify({ merchant_id: merchantId, run_type: 'morning_briefing' })
      })
    )
  )

  return new Response(`Triggered morning briefing for ${uniqueMerchants.length} merchants`)
})
```

Use the same pattern for `trigger-anomaly-scan` and `trigger-invoice-sweep`, changing `run_type` accordingly.

**`supabase/functions/trigger-playbook-runner/index.ts`** — slightly different, checks schedule:

```typescript
Deno.serve(async () => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date()
  const currentTime   = `${String(now.getUTCHours() + 8).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`
  const currentDay    = now.getDay()
  const currentDayOfMonth = now.getDate()

  // Find all active playbooks whose schedule is due right now
  const { data: playbooks } = await admin
    .from('agent_playbooks')
    .select('id, merchant_id, schedule')
    .eq('is_active', true)

  const due = (playbooks ?? []).filter(p => {
    const s = p.schedule
    if (s.type === 'daily'   && s.time === currentTime) return true
    if (s.type === 'weekly'  && s.time === currentTime && s.day === currentDay) return true
    if (s.type === 'monthly' && s.time === currentTime && s.day_of_month === currentDayOfMonth) return true
    return false
  })

  await Promise.allSettled(
    due.map(p =>
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/run-scheduled-agent`, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant_id: p.merchant_id, run_type: 'playbook', playbook_id: p.id })
      })
    )
  )

  return new Response(`Triggered ${due.length} playbook runs`)
})
```


***

## Step 7 — Full Long-Term Memory Retrieval

In Phases 1–4, the orchestrator saved memories but never retrieved them. Wire retrieval into every agent run now — both chat and scheduled:

Update `packages/agent/src/memory/long-term.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import { google }       from '@ai-sdk/google'
import { embed }        from 'ai'

function getAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function saveLongTermMemory(
  merchantId: string,
  content:    string,
  type:       'fact' | 'preference' | 'pattern'
) {
  const admin = getAdmin()
  const { embedding } = await embed({
    model: google.textEmbeddingModel('text-embedding-004'),
    value: content
  })
  await admin.from('agent_memory').insert({ merchant_id: merchantId, type, content, embedding })
}

// NEW: Retrieve relevant memories for a given query
export async function retrieveRelevantMemories(
  merchantId: string,
  query:      string,
  limit:      number = 5
): Promise<string[]> {
  const admin = getAdmin()

  const { embedding } = await embed({
    model: google.textEmbeddingModel('text-embedding-004'),
    value: query
  })

  const { data } = await admin.rpc('match_agent_memory', {
    query_embedding: embedding,
    merchant_id_arg: merchantId,
    match_count:     limit
  })

  return (data ?? [])
    .filter((m: any) => m.similarity > 0.75)  // only high-confidence matches
    .map((m: any) => m.content)
}
```

Update `packages/agent/src/orchestrator.ts` to inject memories into the system prompt:

```typescript
import { retrieveRelevantMemories } from './memory/long-term'

export async function runAgent({ newMessage, merchantId, merchantName, sessionId }: AgentInput) {
  const history  = await loadMessages(sessionId)

  // Retrieve relevant long-term memories for this query
  const memories = await retrieveRelevantMemories(merchantId, newMessage)
  const memoryContext = memories.length > 0
    ? `\n\n## What I know about this merchant\n${memories.map(m => `- ${m}`).join('\n')}`
    : ''

  const messages: CoreMessage[] = [
    ...history,
    { role: 'user', content: newMessage }
  ]

  const result = streamText({
    model: google('gemini-3.1-flash-lite-preview', {
      tools: [{ fileSearch: { fileSearchStoreNames: [process.env.GEMINI_FILE_SEARCH_STORE_ID!] } }]
    }),
    system:   buildSystemPrompt(merchantName) + memoryContext,
    messages,
    tools:    buildTools(merchantId, sessionId),
    maxSteps: 15,
    onFinish: async ({ text }) => {
      await saveMessages(sessionId, merchantId, [
        { role: 'user',      content: newMessage },
        { role: 'assistant', content: text }
      ])
      await touchSession(sessionId)
      await extractAndSaveMemories(merchantId, newMessage, text)
    }
  })

  return result
}
```


***

## Step 8 — Session Summary on Close

When a session ends (merchant navigates away or explicitly closes the chat), write a concise LLM-generated summary to `agent_sessions.summary`. This becomes context for future sessions.

**`apps/dashboard/app/api/agent/sessions/[id]/close/route.ts`:**

```typescript
import { createClient }       from '@/lib/supabase/server'
import { createClient as admin } from '@supabase/supabase-js'
import { generateText }       from 'ai'
import { google }             from '@ai-sdk/google'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const db = admin(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Fetch last 20 messages for this session
  const { data: messages } = await db
    .from('agent_messages')
    .select('role, content')
    .eq('session_id', params.id)
    .eq('merchant_id', user.id)
    .order('created_at', { ascending: true })
    .limit(20)

  if (!messages?.length) return Response.json({ closed: true })

  const transcript = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n')

  // Generate a concise summary for future context
  const { text: summary } = await generateText({
    model: google('gemini-2.0-flash'),
    prompt: `Summarise this merchant-agent conversation in 3 bullet points.
Focus on: decisions made, actions taken, and anything left pending.
Be factual and brief — this summary will be used as future agent context.

Transcript:
${transcript}`
  })

  await db
    .from('agent_sessions')
    .update({ status: 'completed', summary, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('merchant_id', user.id)

  return Response.json({ closed: true, summary })
}
```

Call this route from the chat UI when the session panel closes:

```typescript
// In AgentChatPanel.tsx — on unmount or explicit close
useEffect(() => {
  return () => {
    if (sessionId) {
      navigator.sendBeacon(`/api/agent/sessions/${sessionId}/close`, '{}')
    }
  }
}, [sessionId])
```


***

## Step 9 — Proactive Alerts Dashboard Panel

**`apps/dashboard/components/agent/AlertsPanel.tsx`:**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Alert {
  id:         string
  title:      string
  body:       string
  severity:   'info' | 'warning' | 'critical'
  category:   string
  action?:    { label: string, message: string }
  is_read:    boolean
  created_at: string
}

const SEVERITY_STYLES = {
  info:     'border-blue-200   bg-blue-50   dark:border-blue-800   dark:bg-blue-950',
  warning:  'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950',
  critical: 'border-red-200    bg-red-50    dark:border-red-800    dark:bg-red-950'
}

const SEVERITY_ICONS = { info: 'ℹ️', warning: '⚠️', critical: '🚨' }

export function AlertsPanel({ onAskAgent }: { onAskAgent: (msg: string) => void }) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const supabase = createClient()

  useEffect(() => {
    async function fetchAlerts() {
      const { data } = await supabase
        .from('agent_alerts')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(10)
      setAlerts(data ?? [])
    }

    fetchAlerts()

    const channel = supabase
      .channel('alerts-panel')
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'agent_alerts'
      }, fetchAlerts)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  async function markRead(alertId: string) {
    await supabase.from('agent_alerts').update({ is_read: true }).eq('id', alertId)
    setAlerts(prev => prev.filter(a => a.id !== alertId))
  }

  if (alerts.length === 0) return null

  return (
    <div className="space-y-2">
      {alerts.map(alert => (
        <div key={alert.id}
             className={`border rounded-xl p-4 space-y-2 ${SEVERITY_STYLES[alert.severity]}`}>

          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span>{SEVERITY_ICONS[alert.severity]}</span>
              <p className="text-sm font-semibold">{alert.title}</p>
            </div>
            <button
              onClick={() => markRead(alert.id)}
              className="text-xs text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Dismiss alert"
            >
              ✕
            </button>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">{alert.body}</p>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {new Date(alert.created_at).toLocaleString('en-MY')}
            </span>
            {alert.action && (
              <button
                onClick={() => { onAskAgent(alert.action!.message); markRead(alert.id) }}
                className="text-xs font-medium text-primary hover:underline"
              >
                {alert.action.label} →
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
```


***

## Step 10 — Playbooks Management UI

**`apps/dashboard/app/(dashboard)/agent/playbooks/page.tsx`:**

```tsx
'use client'

import { useEffect, useState } from 'react'

interface Playbook {
  id:              string
  name:            string
  description:     string
  schedule:        { type: string, time?: string }
  is_active:       boolean
  last_run_at:     string | null
  last_run_status: string | null
  last_run_summary: string | null
}

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([])

  useEffect(() => {
    fetch('/api/agent/playbooks')
      .then(r => r.json())
      .then(setPlaybooks)
  }, [])

  async function toggleActive(id: string, current: boolean) {
    await fetch(`/api/agent/playbooks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !current })
    })
    setPlaybooks(prev => prev.map(p => p.id === id ? { ...p, is_active: !current } : p))
  }

  async function runNow(id: string) {
    await fetch(`/api/agent/playbooks/${id}/run`, { method: 'POST' })
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Playbooks</h1>
        <p className="text-sm text-muted-foreground">
          Ask MerchantMind to create a playbook in the chat
        </p>
      </div>

      {playbooks.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          <p className="text-2xl mb-2">🎬</p>
          <p>No playbooks yet</p>
          <p className="mt-1 text-xs">
            Tell MerchantMind: "Create a daily playbook to check my orders at 8am"
          </p>
        </div>
      )}

      {playbooks.map(p => (
        <div key={p.id} className="border rounded-xl p-4 space-y-3 bg-background">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{p.name}</p>
                {p.is_active && (
                  <span className="text-xs bg-green-100 text-green-700
                                   dark:bg-green-950 dark:text-green-300
                                   px-2 py-0.5 rounded-full">active</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{p.description}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => runNow(p.id)}
                className="text-xs px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors"
              >
                Run now
              </button>
              <button
                onClick={() => toggleActive(p.id, p.is_active)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors
                  ${p.is_active
                    ? 'border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
                    : 'border border-green-200 text-green-700 hover:bg-green-50 dark:hover:bg-green-950'}`}
              >
                {p.is_active ? 'Pause' : 'Resume'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>⏱ {p.schedule.type}{p.schedule.time ? ` at ${p.schedule.time}` : ''}</span>
            {p.last_run_at && (
              <span>
                Last run: {new Date(p.last_run_at).toLocaleString('en-MY')} ·{' '}
                <span className={
                  p.last_run_status === 'success' ? 'text-green-600 dark:text-green-400' :
                  p.last_run_status === 'failed'  ? 'text-red-600 dark:text-red-400' :
                  'text-yellow-600 dark:text-yellow-400'
                }>
                  {p.last_run_status}
                </span>
              </span>
            )}
          </div>

          {p.last_run_summary && (
            <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2 leading-relaxed">
              {p.last_run_summary}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
```

Add supporting Route Handlers:

**`apps/dashboard/app/api/agent/playbooks/route.ts`:**

```typescript
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data } = await supabase
    .from('agent_playbooks')
    .select('*')
    .eq('merchant_id', user.id)
    .order('created_at', { ascending: false })

  return Response.json(data ?? [])
}
```

**`apps/dashboard/app/api/agent/playbooks/[id]/run/route.ts`:**

```typescript
import { createClient }  from '@/lib/supabase/server'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Fire the scheduled agent for this playbook
  const res = await fetch(
    `${process.env.SUPABASE_URL}/functions/v1/run-scheduled-agent`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type':  'application/json'
      },
      body: JSON.stringify({
        merchant_id: user.id,
        run_type:    'playbook',
        playbook_id: params.id
      })
    }
  )

  return Response.json(await res.json())
}
```


***

## Step 11 — Update System Prompt with Automation Rules

```typescript
// Add to buildSystemPrompt() in packages/agent/src/prompts/system.ts

## Automation & playbook rules
- When a merchant describes a recurring task, proactively offer to save it as a playbook.
- When saving a playbook, suggest a sensible schedule based on the task type:
  daily briefings → 8:00 AM, invoice sweeps → 6:00 PM, stock checks → 12:00 PM.
- Never execute high-risk actions inside a scheduled playbook — always push_dashboard_alert
  with a CTA so the merchant approves from the dashboard.
- Use get_merchant_snapshot at the start of every morning briefing playbook.
- After detect_anomalies, push alerts for anything severity medium or above.
- When merchant asks "what did you do while I was away", call list_playbooks and
  read last_run_summary from each to give a recap.

## Analytics rules
- Use compare_performance when merchant asks "how am I doing" or any trend question.
- Default comparison: this week vs last week.
- Use generate_business_report for end-of-week and end-of-month summaries.
- Always show percentage change with ▲ for increase and ▼ for decrease.
```


***

## Step 12 — New Edge Functions Required

| Function | Purpose |
| :-- | :-- |
| `run-scheduled-agent` | Core scheduled runner — runs full agent loop headlessly |
| `trigger-morning-briefing` | Cron dispatcher — fires morning briefing for all active merchants |
| `trigger-anomaly-scan` | Cron dispatcher — fires anomaly scan every 15 min |
| `trigger-invoice-sweep` | Cron dispatcher — fires invoice sweep at 6 PM daily |
| `trigger-playbook-runner` | Cron dispatcher — checks due playbooks every minute |
| `run-playbook` | Executes a named playbook's steps via the agent |
| `merchant-snapshot` | Aggregate pending orders, approvals, invoices, low stock into one response |
| `detect-anomalies` | Statistical anomaly detection across all data sources |
| `compare-performance` | Period-over-period metric comparison |
| `generate-business-report` | Full report aggregation across all modules |


***

## Phase 5 Completion Checklist

- [ ] All 3 advanced analytics tools implemented
- [ ] All 5 automation tools implemented
- [ ] Tools index updated — 42 tools total
- [ ] System prompt updated with automation and analytics rules
- [ ] `agent_playbooks`, `agent_alerts`, `agent_scheduled_runs` tables migrated
- [ ] `run-scheduled-agent` Edge Function deployed and handles all 4 run types
- [ ] All 4 cron trigger functions deployed with correct schedules in `config.toml`
- [ ] `trigger-playbook-runner` correctly identifies due playbooks by schedule
- [ ] Long-term memory retrieval wired into `runAgent` — memories injected into system prompt
- [ ] Session summary generated on close via `sendBeacon`
- [ ] `AlertsPanel` live on dashboard home with Realtime subscription
- [ ] Playbooks management page at `/agent/playbooks` working
- [ ] Playbook "Run now" button fires `run-scheduled-agent` and reflects in run log
- [ ] Playbook pause/resume toggle updates `is_active` correctly
- [ ] All 10 new Edge Functions present in `supabase/functions/`
- [ ] End-to-end test: morning briefing cron fires → snapshot taken → alerts pushed → dashboard updates live
- [ ] End-to-end test: anomaly scan detects revenue drop → critical alert pushed with CTA
- [ ] End-to-end test: "create a daily playbook to process orders at 9am" → saved with correct schedule → runs automatically next day
- [ ] End-to-end test: "compare this week vs last week" → percentage changes returned with ▲/▼
- [ ] End-to-end test: "what did you do while I was away?" → last_run_summary from each playbook returned as recap
- [ ] End-to-end test: relevant memories surface in agent response — "merchant prefers EasyParcel" influences shipment recommendation without being asked
<span style="display:none">[^1]</span>

<div align="center">⁂</div>

[^1]: PROJECT_OVERVIEW.md

