<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Continue phase 6

Here is the complete Phase 6 implementation plan.

***

# Phase 6 — Production Hardening, Observability \& Multi-tenancy (Week 11–12)

**Goal:** Make MerchantMind production-safe at scale. This phase adds token budget management so the agent never hits context limits, a full observability layer for tracing every tool call and tracking cost per merchant, rate limiting and abuse guards, multi-tenant isolation hardening, Google Merchant Center as the final marketplace tool, and the hyperlocal agent for `apps/hyperlocal-app`. By the end of Phase 6 the agent is deployable to real merchants.

**Deliverables at end of Phase 6:**

- Context window manager — automatic message pruning and session summarisation before overflow
- Full LLM cost tracking per merchant per session
- Trace log for every agent run — tool calls, latency, token counts
- Rate limiting middleware on all agent routes
- Multi-tenant RLS audit — every table verified, cross-merchant data leak impossible
- Google Merchant Center sync tool added
- Hyperlocal agent wired into `apps/hyperlocal-app`
- Agent quality scoring — automated thumb-up/down collection and weekly quality report
- Graceful fallback for every external API failure

***

## Step 1 — Context Window Manager

Gemini 2.5 Flash has a 1M token context window but loading unbounded message history will eventually become slow and expensive. More importantly, the system prompt + tools schema + memory already consumes \~8,000 tokens before any messages. Implement a manager that keeps the context lean.

**`packages/agent/src/memory/context-manager.ts`:**

```typescript
import { generateText }   from 'ai'
import { google }         from '@ai-sdk/google'
import { createClient }   from '@supabase/supabase-js'
import type { CoreMessage } from 'ai'

// Rough token estimator — 1 token ≈ 4 characters for English
function estimateTokens(messages: CoreMessage[]): number {
  return messages.reduce((sum, m) => {
    const content = typeof m.content === 'string'
      ? m.content
      : JSON.stringify(m.content)
    return sum + Math.ceil(content.length / 4)
  }, 0)
}

const MAX_HISTORY_TOKENS = 12_000   // ~48K chars — leaves headroom for system + tools
const SUMMARY_THRESHOLD  = 10_000   // start summarising when we approach limit

export async function buildContextMessages(
  sessionId:  string,
  merchantId: string,
  newMessage: string
): Promise<CoreMessage[]> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Load the last 40 messages (generous window)
  const { data: rows } = await supabase
    .from('agent_messages')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(40)

  const history: CoreMessage[] = (rows ?? []).map(r => ({
    role:    r.role as 'user' | 'assistant',
    content: r.content
  }))

  const estimated = estimateTokens(history)

  // Under threshold — use as-is
  if (estimated < SUMMARY_THRESHOLD) {
    return [...history, { role: 'user', content: newMessage }]
  }

  // Over threshold — summarise the oldest half, keep recent messages verbatim
  const mid       = Math.floor(history.length / 2)
  const oldHalf   = history.slice(0, mid)
  const recentHalf = history.slice(mid)

  const { text: compressionSummary } = await generateText({
    model:  google('gemini-2.0-flash'),
    prompt: `Summarise this conversation history as a compact context block.
Focus on: decisions made, key facts established, actions completed, anything pending.
Maximum 200 words. Write in third person ("The merchant asked...", "The agent confirmed...").

${oldHalf.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}`
  })

  // Inject summary as a system-style user message at the start
  const compressed: CoreMessage[] = [
    { role: 'user',      content: `[CONTEXT SUMMARY]\n${compressionSummary}` },
    { role: 'assistant', content: 'Understood. I have the context from earlier in our conversation.' },
    ...recentHalf,
    { role: 'user', content: newMessage }
  ]

  // Save the compression event so we don't re-summarise old messages again
  await supabase.from('agent_sessions').update({
    summary:    compressionSummary,
    updated_at: new Date().toISOString()
  }).eq('id', sessionId)

  return compressed
}
```

Update `packages/agent/src/orchestrator.ts` to use `buildContextMessages` instead of `loadMessages`:

```typescript
// Replace:
const history = await loadMessages(sessionId)
const messages: CoreMessage[] = [...history, { role: 'user', content: newMessage }]

// With:
import { buildContextMessages } from './memory/context-manager'
const messages = await buildContextMessages(sessionId, merchantId, newMessage)
```


***

## Step 2 — Observability: Trace Every Run

Create a dedicated tracing layer that records every agent run with token counts, latency per step, tool call results, and total cost.

### Database Schema

```sql
-- Add to packages/db/migrations/

-- Agent traces — one row per agent run (chat turn or scheduled run)
create table agent_traces (
  id              uuid primary key default gen_random_uuid(),
  merchant_id     uuid not null references auth.users(id),
  session_id      uuid references agent_sessions(id),
  run_type        text not null default 'chat',  -- 'chat' | 'scheduled' | 'playbook'
  model           text not null,
  prompt_tokens   int default 0,
  completion_tokens int default 0,
  total_tokens    int default 0,
  estimated_cost_usd numeric(10, 6) default 0,
  steps           int default 0,
  tool_calls      jsonb default '[]',  -- array of { tool, latency_ms, success }
  duration_ms     int,
  status          text default 'completed',  -- 'completed' | 'failed' | 'aborted'
  error           text,
  created_at      timestamptz default now()
);

-- Quality feedback — thumbs up/down per assistant message
create table agent_feedback (
  id          uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id),
  session_id  uuid references agent_sessions(id),
  message_id  uuid,                  -- references agent_messages.id
  rating      smallint not null,     -- 1 = thumbs up, -1 = thumbs down
  comment     text,
  created_at  timestamptz default now()
);

alter table agent_traces   enable row level security;
alter table agent_feedback enable row level security;

create policy "own traces"   on agent_traces   for all using (merchant_id = auth.uid());
create policy "own feedback" on agent_feedback for all using (merchant_id = auth.uid());

create index on agent_traces(merchant_id, created_at desc);
create index on agent_traces(session_id);
create index on agent_feedback(merchant_id, created_at desc);
```


### Tracer Utility

**`packages/agent/src/observability/tracer.ts`:**

```typescript
import { createClient } from '@supabase/supabase-js'

// Gemini 2.5 Flash pricing (as of 2026 — update when pricing changes)
const COST_PER_1K_INPUT  = 0.000075   // $0.075 per 1M input tokens
const COST_PER_1K_OUTPUT = 0.0003     // $0.300 per 1M output tokens

function getAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface StepTrace {
  tool:        string
  latency_ms:  number
  success:     boolean
  error?:      string
}

export class AgentTracer {
  private startTime:   number
  private stepTraces:  StepTrace[] = []
  private stepStart:   number = 0

  constructor(
    private merchantId: string,
    private sessionId:  string,
    private model:      string = 'gemini-2.5-flash',
    private runType:    string = 'chat'
  ) {
    this.startTime = Date.now()
  }

  startStep(toolName: string) {
    this.stepStart = Date.now()
    return toolName
  }

  endStep(toolName: string, success: boolean, error?: string) {
    this.stepTraces.push({
      tool:       toolName,
      latency_ms: Date.now() - this.stepStart,
      success,
      error
    })
  }

  async flush(opts: {
    promptTokens:     number
    completionTokens: number
    steps:            number
    status:           'completed' | 'failed' | 'aborted'
    error?:           string
  }) {
    const totalTokens = opts.promptTokens + opts.completionTokens
    const estimatedCostUsd =
      (opts.promptTokens     / 1000) * COST_PER_1K_INPUT +
      (opts.completionTokens / 1000) * COST_PER_1K_OUTPUT

    const admin = getAdmin()
    await admin.from('agent_traces').insert({
      merchant_id:       this.merchantId,
      session_id:        this.sessionId,
      run_type:          this.runType,
      model:             this.model,
      prompt_tokens:     opts.promptTokens,
      completion_tokens: opts.completionTokens,
      total_tokens:      totalTokens,
      estimated_cost_usd: estimatedCostUsd,
      steps:             opts.steps,
      tool_calls:        this.stepTraces,
      duration_ms:       Date.now() - this.startTime,
      status:            opts.status,
      error:             opts.error ?? null
    })
  }
}
```


### Wire Tracer into Orchestrator

Update `packages/agent/src/orchestrator.ts`:

```typescript
import { AgentTracer } from './observability/tracer'

export async function runAgent({ newMessage, merchantId, merchantName, sessionId }: AgentInput) {
  const tracer   = new AgentTracer(merchantId, sessionId)
  const messages = await buildContextMessages(sessionId, merchantId, newMessage)
  const memories = await retrieveRelevantMemories(merchantId, newMessage)

  const memoryContext = memories.length > 0
    ? `\n\n## What I know about this merchant\n${memories.map(m => `- ${m}`).join('\n')}`
    : ''

  let stepCount = 0

  const result = streamText({
    model: google('gemini-2.5-flash', {
      tools: [{ fileSearch: { fileSearchStoreNames: [process.env.GEMINI_FILE_SEARCH_STORE_ID!] } }]
    }),
    system:   buildSystemPrompt(merchantName) + memoryContext,
    messages,
    tools:    buildTools(merchantId, sessionId),
    maxSteps: 15,

    onStepStart: ({ toolCalls }) => {
      stepCount++
      toolCalls?.forEach(tc => tracer.startStep(tc.toolName))
    },

    onStepFinish: ({ toolResults }) => {
      toolResults?.forEach(r => {
        const success = !(r.result instanceof Error)
        tracer.endStep(
          r.toolName,
          success,
          success ? undefined : String(r.result)
        )
      })
    },

    onFinish: async ({ usage, finishReason }) => {
      await saveMessages(sessionId, merchantId, [
        { role: 'user',      content: newMessage },
      ])
      await touchSession(sessionId)
      await extractAndSaveMemories(merchantId, newMessage, '')

      await tracer.flush({
        promptTokens:     usage.promptTokens,
        completionTokens: usage.completionTokens,
        steps:            stepCount,
        status:           finishReason === 'error' ? 'failed' : 'completed'
      })
    }
  })

  return result
}
```


***

## Step 3 — Rate Limiting

Prevent a single merchant from flooding the agent route and accumulating runaway costs. Use an in-memory sliding window — no Redis needed since Next.js route handlers are stateless at the edge.

**`packages/agent/src/middleware/rate-limiter.ts`:**

```typescript
interface Window {
  count:    number
  resetAt:  number
}

// In-memory store — scoped per deployment instance
// For true distributed rate limiting, replace with Supabase KV or Upstash
const windows = new Map<string, Window>()

export interface RateLimitConfig {
  maxRequests:     number   // requests per window
  windowMs:        number   // window size in ms
  maxTokensPerDay: number   // estimated token budget per merchant per day
}

export const RATE_LIMITS = {
  chat: {
    maxRequests:     30,          // 30 messages per 10 minutes
    windowMs:        10 * 60_000,
    maxTokensPerDay: 500_000      // ~$37.50/day cap per merchant
  },
  scheduled: {
    maxRequests:     100,         // more headroom for automated runs
    windowMs:        60 * 60_000, // per hour
    maxTokensPerDay: 2_000_000
  }
} satisfies Record<string, RateLimitConfig>

export function checkRateLimit(
  merchantId: string,
  type:       keyof typeof RATE_LIMITS = 'chat'
): { allowed: boolean; retryAfterMs?: number } {
  const config = RATE_LIMITS[type]
  const key    = `${merchantId}:${type}`
  const now    = Date.now()

  const win = windows.get(key)

  if (!win || now > win.resetAt) {
    windows.set(key, { count: 1, resetAt: now + config.windowMs })
    return { allowed: true }
  }

  if (win.count >= config.maxRequests) {
    return { allowed: false, retryAfterMs: win.resetAt - now }
  }

  win.count++
  return { allowed: true }
}
```

Apply in the chat Route Handler:

```typescript
// apps/dashboard/app/api/agent/chat/route.ts
import { checkRateLimit } from '@repo/agent/src/middleware/rate-limiter'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Rate limit check
  const limit = checkRateLimit(user.id, 'chat')
  if (!limit.allowed) {
    return new Response(
      JSON.stringify({
        error:   'Rate limit exceeded',
        message: 'Too many messages. Please wait a moment before sending another.',
        retryAfterMs: limit.retryAfterMs
      }),
      {
        status:  429,
        headers: {
          'Content-Type':  'application/json',
          'Retry-After':   String(Math.ceil((limit.retryAfterMs ?? 60_000) / 1000))
        }
      }
    )
  }

  // ... rest of handler
}
```

Update the chat UI to handle 429 gracefully:

```typescript
// In AgentChatPanel.tsx — handle rate limit in onError callback
onError: (error) => {
  if (error.message?.includes('Rate limit')) {
    setErrorMessage('Sending too fast — please wait a moment.')
  } else {
    setErrorMessage('Something went wrong. Please try again.')
  }
}
```


***

## Step 4 — Multi-tenant RLS Audit

A systematic review of every table introduced across all phases. Run this as a migration that adds missing policies and indexes.

```sql
-- packages/db/migrations/rls-audit.sql

-- Verify all agent tables have RLS enabled
-- (these should already be set from previous phases — this is the safety net)
do $$ declare
  t text;
begin
  foreach t in array array[
    'agent_sessions', 'agent_messages', 'agent_actions', 'agent_approvals',
    'agent_memory', 'agent_playbooks', 'agent_alerts', 'agent_scheduled_runs',
    'agent_traces', 'agent_feedback', 'einvoice_submissions', 'merchant_integrations'
  ] loop
    execute format('alter table %I enable row level security', t);
    -- Ensure no table has a policy allowing cross-merchant reads
    execute format(
      'drop policy if exists "allow all" on %I', t
    );
  end loop;
end $$;

-- Add explicit denial policy as defence-in-depth
-- These fire AFTER the allow policies — if no allow policy matches, deny
create policy "deny cross merchant sessions"
  on agent_sessions for select
  using (merchant_id = auth.uid());

create policy "deny cross merchant messages"
  on agent_messages for select
  using (merchant_id = auth.uid());

-- Service role bypass — only Edge Functions running with SERVICE_ROLE_KEY
-- can write across merchants (e.g. scheduled runs writing to any merchant's tables)
-- This is correct — service role bypasses RLS by design.
-- Never expose SERVICE_ROLE_KEY to the frontend.

-- Cross-tenant query guard function
-- Returns error if merchantId does not match auth.uid()
create or replace function assert_own_merchant(merchant_id uuid)
returns void language plpgsql security definer as $$
begin
  if merchant_id != auth.uid() then
    raise exception 'Cross-merchant access denied';
  end if;
end;
$$;
```

**Checklist — verify each manually:**


| Table | RLS | Policy pattern | Service role bypass |
| :-- | :-- | :-- | :-- |
| `agent_sessions` | ✅ | `merchant_id = auth.uid()` | ✅ cron writes |
| `agent_messages` | ✅ | `merchant_id = auth.uid()` | ✅ cron writes |
| `agent_actions` | ✅ | `merchant_id = auth.uid()` | ✅ executor writes |
| `agent_approvals` | ✅ | `merchant_id = auth.uid()` | ✅ executor writes |
| `agent_memory` | ✅ | `merchant_id = auth.uid()` | ✅ orchestrator writes |
| `agent_playbooks` | ✅ | `merchant_id = auth.uid()` | ✅ cron reads |
| `agent_alerts` | ✅ | `merchant_id = auth.uid()` | ✅ scheduled agent writes |
| `agent_traces` | ✅ | `merchant_id = auth.uid()` | ✅ tracer writes |
| `agent_feedback` | ✅ | `merchant_id = auth.uid()` | ❌ user only |
| `einvoice_submissions` | ✅ | `merchant_id = auth.uid()` | ✅ LHDN poller |
| `merchant_integrations` | ✅ | `merchant_id = auth.uid()` | ✅ secret saver |


***

## Step 5 — Google Merchant Center Tool

The final marketplace tool missing from Phase 3. Add to `packages/agent/src/tools/marketplace.ts`:

```typescript
// Append to existing marketplace.ts

// Tool 6: Sync to Google Merchant Center — medium risk
export const syncGoogleMerchant = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Push product listings to Google Merchant Center for Google Shopping ads. Use this to keep Google Shopping inventory in sync with the merchant catalogue.',
    parameters: z.object({
      product_ids:  z.array(z.string()).min(1)
                    .describe('Product IDs to sync — omit to sync all active products'),
      operation:    z.enum(['upsert', 'delete']).default('upsert'),
      target_country: z.enum(['MY', 'SG', 'ID']).default('MY')
                    .describe('Target country for the Google Merchant feed')
    }),
    execute: (input) =>
      executeWithGuard('sync_google_merchant', input, { riskLevel: 'medium' }, merchantId, sessionId,
        () => edgeCall('sync-google-merchant', { ...input, merchant_id: merchantId }))
  })

// Tool 7: Get Google Merchant diagnostics — low risk
export const getGoogleMerchantDiagnostics = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Fetch Google Merchant Center product diagnostics — disapproved products, policy violations, missing attributes, and feed health score.',
    parameters: z.object({
      issue_type: z.array(z.enum([
        'disapproved', 'policy_violation', 'missing_attribute',
        'low_quality', 'all'
      ])).default(['all'])
    }),
    execute: (input) =>
      executeWithGuard('get_google_merchant_diagnostics', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('google-merchant-diagnostics', { ...input, merchant_id: merchantId }))
  })
```

Add to the tools index under Marketplace (now 7 tools):

```typescript
sync_google_merchant:           syncGoogleMerchant(merchantId, sessionId),
get_google_merchant_diagnostics: getGoogleMerchantDiagnostics(merchantId, sessionId),
```

Add `google-merchant-diagnostics` widget alongside the existing `ListingHealthWidget`:

```typescript
// In ListingHealthWidget, add a Google tab:
// "Shopee/Lazada/TikTok | Google Shopping"
// Clicking Google tab calls getGoogleMerchantDiagnostics via the agent CTA
```


***

## Step 6 — Hyperlocal Agent

`apps/hyperlocal-app` is a separate Next.js app for rapid local fulfilment. Wire the agent into it with a stripped-down toolset focused on speed — only the tools relevant to same-day delivery operations.

**`apps/hyperlocal-app/app/api/agent/chat/route.ts`:**

```typescript
import { streamText }      from 'ai'
import { google }          from '@ai-sdk/google'
import { createClient }    from '@/lib/supabase/server'
import { buildContextMessages } from '@repo/agent/src/memory/context-manager'
import { createSession, saveMessages, touchSession } from '@repo/agent/src/memory/messages'
import { AgentTracer }     from '@repo/agent/src/observability/tracer'
import { checkRateLimit }  from '@repo/agent/src/middleware/rate-limiter'

// Hyperlocal uses a curated subset of tools — only what matters for same-day ops
import { listOrders, getOrderDetails, updateOrderStatus } from '@repo/agent/src/tools/orders'
import { checkDeliveryRates, createLalamoveBooking,
         getShipmentTracking, cancelShipment }            from '@repo/agent/src/tools/logistics'
import { verifyPaymentStatus, createPaymentLink }         from '@repo/agent/src/tools/payments'
import { getMerchantSnapshot, pushDashboardAlert }        from '@repo/agent/src/tools/automation'

function buildHyperlocalTools(merchantId: string, sessionId: string) {
  return {
    list_orders:             listOrders(merchantId, sessionId),
    get_order_details:       getOrderDetails(merchantId, sessionId),
    update_order_status:     updateOrderStatus(merchantId, sessionId),
    check_delivery_rates:    checkDeliveryRates(merchantId, sessionId),
    create_lalamove_booking: createLalamoveBooking(merchantId, sessionId),
    get_shipment_tracking:   getShipmentTracking(merchantId, sessionId),
    cancel_shipment:         cancelShipment(merchantId, sessionId),
    verify_payment_status:   verifyPaymentStatus(merchantId, sessionId),
    create_payment_link:     createPaymentLink(merchantId, sessionId),
    get_merchant_snapshot:   getMerchantSnapshot(merchantId, sessionId),
    push_dashboard_alert:    pushDashboardAlert(merchantId, sessionId)
  }
}

const HYPERLOCAL_SYSTEM_PROMPT = (merchantName: string) => `
You are MerchantMind Hyperlocal, a fast-response delivery operations assistant for ${merchantName}.

## Focus
Same-day and on-demand local deliveries via Lalamove only.
Speed is the priority — respond in under 100 words unless detail is required.

## Rules
- ALWAYS check delivery rates before booking.
- ALWAYS verify payment before booking a shipment.
- For urgent orders, suggest Lalamove MOTORCYCLE for fastest pickup.
- Never suggest EasyParcel — this app is for same-day local delivery only.
- For any non-delivery question, say "Please use the main dashboard for that."

## Formatting
- RM for currency, km for distances, DD/MM/YYYY HH:mm for times
- ✅ success  ⚠️ warning  ❌ error

Now: ${new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}
`.trim()

export const maxDuration = 45

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const limit = checkRateLimit(user.id, 'chat')
  if (!limit.allowed) return new Response('Rate limit exceeded', { status: 429 })

  const { newMessage, sessionId: existingSessionId }
    : { newMessage: string, sessionId?: string } = await req.json()

  const sessionId = existingSessionId ?? await createSession(user.id, newMessage)

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_name')
    .eq('id', user.id)
    .single()

  const messages = await buildContextMessages(sessionId, user.id, newMessage)
  const tracer   = new AgentTracer(user.id, sessionId, 'gemini-2.5-flash', 'hyperlocal')

  const result = streamText({
    model:    google('gemini-2.5-flash'),
    system:   HYPERLOCAL_SYSTEM_PROMPT(profile?.business_name ?? 'Merchant'),
    messages,
    tools:    buildHyperlocalTools(user.id, sessionId),
    maxSteps: 8,    // tighter limit for hyperlocal — speed over depth
    onFinish: async ({ text, usage }) => {
      await saveMessages(sessionId, user.id, [
        { role: 'user',      content: newMessage },
        { role: 'assistant', content: text }
      ])
      await touchSession(sessionId)
      await tracer.flush({
        promptTokens:     usage.promptTokens,
        completionTokens: usage.completionTokens,
        steps:            0,
        status:           'completed'
      })
    }
  })

  const response = result.toDataStreamResponse()
  const headers  = new Headers(response.headers)
  headers.set('x-session-id', sessionId)
  return new Response(response.body, { headers, status: response.status })
}
```


***

## Step 7 — Graceful Fallback for Every External API

Every tool that calls an external API (Lalamove, EasyParcel, Shopee, Billplz, etc.) needs a fallback strategy when the external service is down. Add a fallback wrapper to `packages/agent/src/middleware/executor.ts`:

```typescript
// Add to executor.ts

export interface FallbackConfig {
  maxRetries:    number
  retryDelayMs:  number
  fallbackValue?: unknown   // return this if all retries fail instead of throwing
}

export async function withRetry<T>(
  fn:       () => Promise<T>,
  config:   FallbackConfig = { maxRetries: 2, retryDelayMs: 1000 }
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err

      // Don't retry on 4xx — these are caller errors, not transient
      if (err instanceof Response && err.status >= 400 && err.status < 500) throw err

      if (attempt < config.maxRetries) {
        await new Promise(r => setTimeout(r, config.retryDelayMs * (attempt + 1)))
      }
    }
  }

  // All retries exhausted
  if (config.fallbackValue !== undefined) return config.fallbackValue as T
  throw lastError
}
```

Wrap external calls in logistics and marketplace tools:

```typescript
// Example — update check_delivery_rates execute:
execute: (input) =>
  executeWithGuard('check_delivery_rates', input, { riskLevel: 'low' }, merchantId, sessionId,
    () => withRetry(
      () => edgeCall('check-delivery-rates', { ...input, merchant_id: merchantId }),
      {
        maxRetries:   2,
        retryDelayMs: 800,
        fallbackValue: {
          error:   'delivery_api_unavailable',
          message: 'Delivery rate service is temporarily unavailable. Please try again in a few minutes.',
          rates:   []
        }
      }
    ))
```

Add a system prompt addendum so the agent knows how to handle fallback responses:

```typescript
// In buildSystemPrompt() — add to Behaviour rules:
// - If a tool returns error: 'delivery_api_unavailable' or similar error codes,
//   tell the merchant the service is temporarily down and suggest retrying in 5 minutes.
//   Never fabricate rates or statuses — always be honest about API availability.
```


***

## Step 8 — Agent Observability Dashboard

Build an internal observability page for you (the developer) to monitor agent health across all merchants. Accessible at `/admin/agent-health` — protected by a separate admin role check.

**`apps/dashboard/app/(admin)/admin/agent-health/page.tsx`:**

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect }     from 'next/navigation'

async function getAgentStats() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Admin-only page — check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user?.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  // Use service role for cross-merchant queries
  const { createClient: adminClient } = await import('@supabase/supabase-js')
  const admin = adminClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Last 24h stats
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [traces, errors, costs, feedback] = await Promise.all([
    admin.from('agent_traces').select('id', { count: 'exact' }).gte('created_at', since),
    admin.from('agent_traces').select('id', { count: 'exact' }).eq('status', 'failed').gte('created_at', since),
    admin.from('agent_traces').select('estimated_cost_usd').gte('created_at', since),
    admin.from('agent_feedback').select('rating').gte('created_at', since)
  ])

  const totalCost    = costs.data?.reduce((s, r) => s + (r.estimated_cost_usd ?? 0), 0) ?? 0
  const thumbsUp     = feedback.data?.filter(f => f.rating === 1).length ?? 0
  const thumbsDown   = feedback.data?.filter(f => f.rating === -1).length ?? 0
  const satisfactionRate = thumbsUp + thumbsDown > 0
    ? Math.round((thumbsUp / (thumbsUp + thumbsDown)) * 100)
    : null

  return {
    totalRuns:        traces.count  ?? 0,
    failedRuns:       errors.count  ?? 0,
    totalCostUsd:     totalCost,
    thumbsUp,
    thumbsDown,
    satisfactionRate
  }
}

export default async function AgentHealthPage() {
  const stats = await getAgentStats()

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <h1 className="text-xl font-semibold">Agent Health — Last 24h</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Runs',     value: stats.totalRuns.toLocaleString() },
          { label: 'Failed Runs',    value: stats.failedRuns.toLocaleString(),
            alert: stats.failedRuns > 10 },
          { label: 'Total Cost',     value: `$${stats.totalCostUsd.toFixed(4)}` },
          { label: 'Thumbs Up',      value: stats.thumbsUp.toLocaleString() },
          { label: 'Thumbs Down',    value: stats.thumbsDown.toLocaleString() },
          { label: 'Satisfaction',   value: stats.satisfactionRate != null
                                       ? `${stats.satisfactionRate}%`
                                       : 'N/A' }
        ].map(kpi => (
          <div key={kpi.label}
               className={`border rounded-xl p-4 space-y-1
                 ${(kpi as any).alert
                   ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950'
                   : 'bg-background'}`}>
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="text-2xl font-bold">{kpi.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```


***

## Step 9 — Quality Feedback UI

Add a thumbs up/down button pair after every assistant message in `AgentChatPanel`. This feeds the `agent_feedback` table and powers the satisfaction rate in the health dashboard.

Update `apps/dashboard/components/agent/AgentChatPanel.tsx` — add to each assistant message bubble:

```tsx
interface FeedbackButtonsProps {
  messageId:  string
  sessionId:  string
}

function FeedbackButtons({ messageId, sessionId }: FeedbackButtonsProps) {
  const [rated, setRated] = useState<1 | -1 | null>(null)

  async function rate(rating: 1 | -1) {
    if (rated) return
    setRated(rating)
    await fetch('/api/agent/feedback', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message_id: messageId, session_id: sessionId, rating })
    })
  }

  if (rated) return (
    <span className="text-xs text-muted-foreground">
      {rated === 1 ? 'Thanks for the feedback ✓' : 'Got it, will improve ✓'}
    </span>
  )

  return (
    <div className="flex gap-1 mt-1">
      <button
        onClick={() => rate(1)}
        className="text-sm px-2 py-0.5 rounded hover:bg-muted transition-colors"
        aria-label="Helpful"
      >
        👍
      </button>
      <button
        onClick={() => rate(-1)}
        className="text-sm px-2 py-0.5 rounded hover:bg-muted transition-colors"
        aria-label="Not helpful"
      >
        👎
      </button>
    </div>
  )
}
```

**`apps/dashboard/app/api/agent/feedback/route.ts`:**

```typescript
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { message_id, session_id, rating, comment }
    : { message_id: string, session_id: string, rating: 1 | -1, comment?: string }
    = await req.json()

  await supabase.from('agent_feedback').insert({
    merchant_id: user.id,
    session_id,
    message_id,
    rating,
    comment: comment ?? null
  })

  return Response.json({ saved: true })
}
```


***

## Step 10 — Update Tools Index (Final)

**`packages/agent/src/tools/index.ts`** — complete final version with all 44 tools:

```typescript
// ... all existing imports ...
import { syncGoogleMerchant,
         getGoogleMerchantDiagnostics } from './marketplace'

export const buildTools = (merchantId: string, sessionId: string) => ({
  // Orders (6)
  // Logistics (6)
  // Marketplace (7) ← now includes 2 Google Merchant tools
  sync_google_merchant:             syncGoogleMerchant(merchantId, sessionId),
  get_google_merchant_diagnostics:  getGoogleMerchantDiagnostics(merchantId, sessionId),
  // ... rest unchanged from Phase 5
})
```

Total: **44 tools** across all modules.

***

## Step 11 — Final System Prompt

```typescript
// Add to buildSystemPrompt() — new sections:

## Error handling rules
- If a tool returns error: '*_unavailable', tell the merchant the service is temporarily
  down and suggest retrying in 5 minutes. Never fabricate data.
- If a tool returns error: 'rate_limit_exceeded' from an external API, tell the merchant
  and suggest spacing out bulk operations.
- If LHDN returns an error code, look it up in the knowledge base and explain it.

## Google Merchant rules
- Call get_google_merchant_diagnostics before any sync to identify issues first.
- Disapproved products must have issues resolved before sync — never re-push a
  disapproved product without fixing the root cause.
- After a successful sync, report the count of products pushed per country.

## Quality & improvement
- If a merchant says "that's wrong", "incorrect", or similar corrections, acknowledge
  the mistake, correct the response, and save the correction as a long-term memory fact.
- Prefer concise answers. If an answer exceeds 300 words, summarise the key points first.
```


***

## Step 12 — Final Edge Functions

| Function | Purpose |
| :-- | :-- |
| `sync-google-merchant` | Push product feed to Google Content API |
| `google-merchant-diagnostics` | Fetch disapproval reasons and feed health |
| `compare-performance` | Already added in Phase 5 |
| `merchant-snapshot` | Already added in Phase 5 |


***

## Phase 6 Completion Checklist

- [ ] `buildContextMessages` replaces `loadMessages` in orchestrator — compression tested with 40+ message session
- [ ] `agent_traces` and `agent_feedback` tables migrated with RLS
- [ ] `AgentTracer` flushed in `onFinish` for all run types — chat, scheduled, hyperlocal
- [ ] Cost per run visible in `agent_traces.estimated_cost_usd`
- [ ] Rate limiter applied to chat route — 429 returns with `Retry-After` header
- [ ] Chat UI displays human-friendly message on rate limit hit
- [ ] RLS audit migration applied — all 11 tables verified
- [ ] `assert_own_merchant` function deployed
- [ ] `sync_google_merchant` and `get_google_merchant_diagnostics` tools added — 44 tools total
- [ ] Google Merchant secrets configurable from `/settings/integrations`
- [ ] `apps/hyperlocal-app` agent route live with 11-tool focused toolset
- [ ] Hyperlocal system prompt enforces Lalamove-only, speed-first behaviour
- [ ] `withRetry` wrapper applied to all external API calls in logistics + marketplace tools
- [ ] Fallback values return human-readable error objects — agent explains clearly
- [ ] `/admin/agent-health` page accessible — shows 24h KPIs
- [ ] Thumbs up/down buttons render after every assistant message
- [ ] Feedback saves to `agent_feedback` — satisfaction rate appears in health dashboard
- [ ] Session summary written on close via `sendBeacon`
- [ ] Long-term memory retrieval injected into every agent run — memories visible in system prompt context
- [ ] End-to-end test: send 31 messages within 10 min → 31st returns 429
- [ ] End-to-end test: load 45-message session → context compression fires → agent still has context
- [ ] End-to-end test: Lalamove API down → tool returns fallback → agent says "service temporarily unavailable"
- [ ] End-to-end test: thumbs down on a message → saved to DB → satisfaction rate updates in health dashboard
- [ ] End-to-end test: hyperlocal agent asked about invoices → replies "please use main dashboard"
- [ ] End-to-end test: sync product to Google Merchant → diagnostics checked first → product pushed

***

## Full Phase Summary — All 6 Phases

| Phase | Focus | Tools Added | Total Tools |
| :-- | :-- | :-- | :-- |
| 1 | Foundation, chat UI, LHDN knowledge base | 5 | 5 |
| 2 | Orders \& logistics, approval queue | 9 | 14 |
| 3 | Marketplace \& payments | 10 | 24 |
| 4 | E-invoicing \& CRM | 10 | 34 |
| 5 | Proactive intelligence \& automation | 8 | 42 |
| 6 | Production hardening \& observability | 2 | 44 |

