<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# In this case, remove telegram. Rewrite the implementation plan

Here is the fully rewritten Phase 1 plan — dashboard only, no Telegram, with the multi-tenant gaps from the previous review already baked in.

***

# Phase 1 — Foundation (Week 1–2)

**Goal:** A working agent reachable from the merchant dashboard that can answer LHDN e-invoice questions, perform basic order lookups, and persist conversation history across sessions. Multi-tenant safe from day one.

**Deliverables at end of Phase 1:**

- `packages/agent` fully scaffolded
- 5 Supabase tables migrated with RLS
- Agent Route Handler live at `/api/agent/chat`
- Dashboard chat panel working with streamed responses
- Tool call progress visible inline in the chat
- Conversation history persisted and restored on page refresh
- LHDN documents loaded into Gemini File Search store
- 5 starter tools working end-to-end
- High-risk actions routing to Approval Queue instead of executing

***

## Step 1 — Install Dependencies

In `packages/agent`:

```bash
pnpm add ai @ai-sdk/google zod
pnpm add -D tsx @types/node
```

In `apps/dashboard`:

```bash
pnpm add ai @ai-sdk/react uuid
pnpm add -D @types/uuid
```


***

## Step 2 — Scaffold `packages/agent`

```
packages/agent/
├── package.json
├── index.ts
└── src/
    ├── orchestrator.ts
    ├── tools/
    │   ├── index.ts
    │   ├── orders.ts
    │   ├── analytics.ts
    │   └── knowledge.ts
    ├── memory/
    │   ├── long-term.ts
    │   └── messages.ts
    ├── middleware/
    │   └── executor.ts
    └── prompts/
        └── system.ts
```

**`packages/agent/package.json`:**

```json
{
  "name": "@repo/agent",
  "version": "0.1.0",
  "exports": {
    ".": "./index.ts"
  },
  "dependencies": {
    "ai": "latest",
    "@ai-sdk/google": "latest",
    "zod": "latest"
  }
}
```

**`packages/agent/index.ts`:**

```typescript
export { runAgent } from './src/orchestrator'
export { buildTools } from './src/tools'
export type { AgentInput } from './src/orchestrator'
```


***

## Step 3 — Database Schema

Add this migration to `packages/db/migrations/`:

```sql
-- Enable pgvector
create extension if not exists vector;

-- 1. Agent sessions
create table agent_sessions (
  id          uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id),
  title       text,                          -- auto-generated from first message
  status      text not null default 'active',-- 'active' | 'completed'
  summary     text,                          -- LLM summary written on session close
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 2. Message history (persisted per session)
create table agent_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references agent_sessions(id) on delete cascade,
  merchant_id uuid not null references auth.users(id),
  role        text not null,   -- 'user' | 'assistant'
  content     text not null,
  created_at  timestamptz default now()
);

-- 3. Audit log
create table agent_actions (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid references agent_sessions(id),
  merchant_id  uuid not null references auth.users(id),
  tool_name    text not null,
  input        jsonb,
  output       jsonb,
  risk_level   text not null default 'low',
  status       text not null default 'executed',
  -- 'executed' | 'pending_approval' | 'approved' | 'rejected' | 'failed'
  snapshot     jsonb,          -- pre-action state for rollback
  triggered_by text not null default 'agent',
  executed_at  timestamptz default now()
);

-- 4. Approval queue
create table agent_approvals (
  id            uuid primary key default gen_random_uuid(),
  action_id     uuid not null references agent_actions(id),
  merchant_id   uuid not null references auth.users(id),
  risk_level    text not null,
  title         text not null,
  description   text not null,
  tool_name     text not null,
  tool_input    jsonb,
  status        text not null default 'pending',
  -- 'pending' | 'approved' | 'rejected'
  approved_by   uuid references auth.users(id),
  reject_reason text,
  created_at    timestamptz default now(),
  resolved_at   timestamptz
);

-- 5. Long-term memory
create table agent_memory (
  id          uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id),
  type        text not null,   -- 'fact' | 'preference' | 'pattern'
  content     text not null,
  embedding   vector(768),     -- Gemini text-embedding-004 = 768 dims
  created_at  timestamptz default now()
);

-- Indexes
create index on agent_sessions(merchant_id, created_at desc);
create index on agent_messages(session_id, created_at asc);
create index on agent_actions(merchant_id, executed_at desc);
create index on agent_approvals(merchant_id, status);
create index on agent_memory using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- RLS
alter table agent_sessions  enable row level security;
alter table agent_messages  enable row level security;
alter table agent_actions   enable row level security;
alter table agent_approvals enable row level security;
alter table agent_memory    enable row level security;

create policy "own sessions"  on agent_sessions  for all using (merchant_id = auth.uid());
create policy "own messages"  on agent_messages  for all using (merchant_id = auth.uid());
create policy "own actions"   on agent_actions   for all using (merchant_id = auth.uid());
create policy "own approvals" on agent_approvals for all using (merchant_id = auth.uid());
create policy "own memory"    on agent_memory    for all using (merchant_id = auth.uid());

-- Memory similarity search function
create or replace function match_agent_memory(
  query_embedding  vector(768),
  merchant_id_arg  uuid,
  match_count      int default 5
)
returns table (id uuid, content text, type text, similarity float)
language sql stable as $$
  select id, content, type,
    1 - (embedding <=> query_embedding) as similarity
  from agent_memory
  where merchant_id = merchant_id_arg
  order by embedding <=> query_embedding
  limit match_count;
$$;
```


***

## Step 4 — Tool Executor Middleware

**`packages/agent/src/middleware/executor.ts`:**

```typescript
import { createClient } from '@supabase/supabase-js'

export type RiskLevel = 'low' | 'medium' | 'high'

export interface ToolMeta {
  riskLevel: RiskLevel
  approvalTitle?:       (input: unknown) => string
  approvalDescription?: (input: unknown) => string
}

export class AwaitingApprovalError extends Error {
  constructor(
    public approvalId: string,
    public actionId:   string,
    public title:      string
  ) {
    super(`Awaiting merchant approval: ${title}`)
    this.name = 'AwaitingApprovalError'
  }
}

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function executeWithGuard<T>(
  toolName:   string,
  input:      unknown,
  meta:       ToolMeta,
  merchantId: string,
  sessionId:  string,
  fn:         () => Promise<T>
): Promise<T> {
  const supabase = getSupabase()

  // Log action
  const { data: action } = await supabase
    .from('agent_actions')
    .insert({
      session_id:  sessionId,
      merchant_id: merchantId,
      tool_name:   toolName,
      input,
      risk_level:  meta.riskLevel,
      status:      meta.riskLevel === 'high' ? 'pending_approval' : 'executed'
    })
    .select()
    .single()

  // High risk → write to approval queue and halt
  if (meta.riskLevel === 'high') {
    const title = meta.approvalTitle?.(input) ?? toolName
    const description = meta.approvalDescription?.(input) ?? JSON.stringify(input)

    const { data: approval } = await supabase
      .from('agent_approvals')
      .insert({
        action_id:   action.id,
        merchant_id: merchantId,
        risk_level:  'high',
        title,
        description,
        tool_name:   toolName,
        tool_input:  input
      })
      .select()
      .single()

    throw new AwaitingApprovalError(approval.id, action.id, title)
  }

  // Low / medium → execute and record result
  try {
    const result = await fn()
    await supabase
      .from('agent_actions')
      .update({ output: result, status: 'executed' })
      .eq('id', action.id)
    return result
  } catch (err) {
    await supabase
      .from('agent_actions')
      .update({ status: 'failed', output: { error: String(err) } })
      .eq('id', action.id)
    throw err
  }
}
```


***

## Step 5 — Message Persistence Helpers

**`packages/agent/src/memory/messages.ts`:**

```typescript
import { createClient } from '@supabase/supabase-js'
import type { CoreMessage } from 'ai'

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Load last N messages for a session (for context window)
export async function loadMessages(
  sessionId: string,
  limit = 20
): Promise<CoreMessage[]> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('agent_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit)

  return (data ?? []) as CoreMessage[]
}

// Save a batch of new messages after a turn
export async function saveMessages(
  sessionId:  string,
  merchantId: string,
  messages:   CoreMessage[]
): Promise<void> {
  const supabase = getSupabase()
  await supabase.from('agent_messages').insert(
    messages.map(m => ({
      session_id:  sessionId,
      merchant_id: merchantId,
      role:        m.role,
      content:     typeof m.content === 'string'
                     ? m.content
                     : JSON.stringify(m.content)
    }))
  )
}

// Create a new session and return its ID
export async function createSession(merchantId: string, firstMessage: string) {
  const supabase = getSupabase()
  // Auto-title: first 60 chars of first user message
  const title = firstMessage.slice(0, 60) + (firstMessage.length > 60 ? '…' : '')
  const { data } = await supabase
    .from('agent_sessions')
    .insert({ merchant_id: merchantId, title })
    .select('id')
    .single()
  return data!.id as string
}

// Bump updated_at on every turn
export async function touchSession(sessionId: string) {
  const supabase = getSupabase()
  await supabase
    .from('agent_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId)
}
```


***

## Step 6 — Starter Tools

**`packages/agent/src/tools/orders.ts`:**

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

export const listOrders = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Fetch orders with optional filters for status, marketplace, or date range. Use this to answer questions about order counts, recent orders, or pending orders.',
    parameters: z.object({
      status:      z.enum(['pending','paid','processing','shipped','completed','cancelled']).optional(),
      marketplace: z.enum(['shopee','lazada','tiktok','all']).default('all'),
      limit:       z.number().min(1).max(100).default(20),
      date_from:   z.string().optional().describe('ISO date string e.g. 2026-04-01')
    }),
    execute: (input) =>
      executeWithGuard('list_orders', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('list-orders', { ...input, merchant_id: merchantId }))
  })

export const getOrderDetails = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Get full details for a single order by ID, including line items, customer info, and shipment status.',
    parameters: z.object({
      order_id: z.string().describe('The order ID e.g. SHP-8821')
    }),
    execute: (input) =>
      executeWithGuard('get_order_details', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('get-order', { ...input, merchant_id: merchantId }))
  })

export const cancelOrder = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Cancel an order. Always confirm the order ID and reason with the merchant before calling this tool.',
    parameters: z.object({
      order_id: z.string(),
      reason:   z.string()
    }),
    execute: (input) =>
      executeWithGuard('cancel_order', input, {
        riskLevel:           'high',
        approvalTitle:       (i: any) => `Cancel Order #${i.order_id}`,
        approvalDescription: (i: any) =>
          `Agent wants to cancel order #${i.order_id}. Reason: ${i.reason}`
      }, merchantId, sessionId,
        () => edgeCall('cancel-order', { ...input, merchant_id: merchantId }))
  })
```

**`packages/agent/src/tools/analytics.ts`:**

```typescript
import { tool } from 'ai'
import { z } from 'zod'
import { executeWithGuard } from '../middleware/executor'

function edgeCall(path: string, body: object) {
  return fetch(`${process.env.SUPABASE_URL}/functions/v1/${path}`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json())
}

export const getSalesSummary = (merchantId: string, sessionId: string) =>
  tool({
    description: 'Get total revenue, order count, and average order value for a time period.',
    parameters: z.object({
      period: z.enum(['today','yesterday','this_week','last_week','this_month','last_month'])
    }),
    execute: (input) =>
      executeWithGuard('get_sales_summary', input, { riskLevel: 'low' }, merchantId, sessionId,
        () => edgeCall('sales-summary', { ...input, merchant_id: merchantId }))
  })
```

**`packages/agent/src/tools/knowledge.ts`:**

```typescript
import { tool } from 'ai'
import { z } from 'zod'

// Gemini File Search is wired at the model level in the orchestrator.
// This tool signals to the agent that it should use grounded retrieval
// when answering regulatory questions.
export const searchKnowledgeBase = tool({
  description: 'Search Malaysia e-invoicing regulatory knowledge base. Use this for any question about LHDN rules, e-invoice requirements, implementation phases, tax codes, submission deadlines, penalties, or compliance obligations.',
  parameters: z.object({
    query: z.string().describe('The regulatory question to search for')
  }),
  execute: async ({ query }) => ({
    search_query: query,
    instruction: 'Answer using the connected File Search store. Cite the source document and section.'
  })
})
```

**`packages/agent/src/tools/index.ts`:**

```typescript
import { listOrders, getOrderDetails, cancelOrder } from './orders'
import { getSalesSummary } from './analytics'
import { searchKnowledgeBase } from './knowledge'

export const buildTools = (merchantId: string, sessionId: string) => ({
  list_orders:           listOrders(merchantId, sessionId),
  get_order_details:     getOrderDetails(merchantId, sessionId),
  cancel_order:          cancelOrder(merchantId, sessionId),
  get_sales_summary:     getSalesSummary(merchantId, sessionId),
  search_knowledge_base: searchKnowledgeBase
})
```


***

## Step 7 — System Prompt

**`packages/agent/src/prompts/system.ts`:**

```typescript
export function buildSystemPrompt(merchantName: string): string {
  return `
You are MerchantMind, an autonomous operations assistant for ${merchantName}'s e-commerce business on this merchant dashboard.

## Capabilities
- Look up and summarise orders across all marketplaces
- Retrieve sales performance and analytics
- Answer questions about Malaysia LHDN e-invoicing regulations (use search_knowledge_base for these)
- Cancel orders — this requires merchant approval before it executes

## Behaviour rules
- Lead with the answer, then give supporting detail.
- Before performing any action, state clearly what you are about to do.
- After completing a task, suggest the logical next step.
- For e-invoice questions, always cite the source document and section number.
- Never invent order IDs, amounts, or dates — always retrieve from tools.
- If an action is sent for approval, tell the merchant what is pending and where to find it.
- Keep responses under 200 words unless the merchant asks for full detail.

## Formatting
- Bullet points for lists of items
- RM prefix for all currency amounts
- DD/MM/YYYY for dates
- Use ✅ for success, ⚠️ for warnings, ❌ for errors

Today: ${new Date().toLocaleDateString('en-MY', { dateStyle: 'full' })}
`.trim()
}
```


***

## Step 8 — Orchestrator

**`packages/agent/src/orchestrator.ts`:**

```typescript
import { streamText, type CoreMessage } from 'ai'
import { google } from '@ai-sdk/google'
import { buildTools } from './tools'
import { buildSystemPrompt } from './prompts/system'
import { loadMessages, saveMessages, touchSession } from './memory/messages'
import { AwaitingApprovalError } from './middleware/executor'

export interface AgentInput {
  newMessage:   string        // the latest user message
  merchantId:   string
  merchantName: string
  sessionId:    string
}

export async function runAgent({
  newMessage,
  merchantId,
  merchantName,
  sessionId
}: AgentInput) {
  // Load persisted history for this session
  const history = await loadMessages(sessionId)

  // Append the new user message
  const messages: CoreMessage[] = [
    ...history,
    { role: 'user', content: newMessage }
  ]

  const tools = buildTools(merchantId, sessionId)

  const result = streamText({
    model: google('gemini-3.1-flash-lite-preview', {
      // Gemini File Search store for LHDN regulatory knowledge
      tools: [{
        fileSearch: {
          fileSearchStoreNames: [process.env.GEMINI_FILE_SEARCH_STORE_ID!]
        }
      }]
    }),
    system:   buildSystemPrompt(merchantName),
    messages,
    tools,
    maxSteps: 15,
    onFinish: async ({ text }) => {
      // Persist both the user message and agent reply
      await saveMessages(sessionId, merchantId, [
        { role: 'user',      content: newMessage },
        { role: 'assistant', content: text }
      ])
      await touchSession(sessionId)
    },
    onStepFinish: async ({ toolResults }) => {
      for (const r of toolResults ?? []) {
        if (r.result instanceof AwaitingApprovalError) {
          // The error message will surface in the stream naturally
          // Agent loop halts cleanly
        }
      }
    }
  })

  return result
}
```


***

## Step 9 — Route Handler

**`apps/dashboard/app/api/agent/chat/route.ts`:**

```typescript
import { runAgent }      from '@repo/agent'
import { createClient }  from '@/lib/supabase/server'
import { createSession } from '@repo/agent/src/memory/messages'

export const maxDuration = 60

export async function POST(req: Request) {
  // Authenticate from Supabase session cookie
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { newMessage, sessionId: existingSessionId }
    : { newMessage: string, sessionId?: string } = await req.json()

  if (!newMessage?.trim()) return new Response('Empty message', { status: 400 })

  // Get or create session
  const sessionId = existingSessionId
    ?? await createSession(user.id, newMessage)

  // Fetch merchant name
  const { data: profile } = await supabase
    .from('profiles')
    .select('business_name')
    .eq('id', user.id)
    .single()

  const result = await runAgent({
    newMessage,
    merchantId:   user.id,
    merchantName: profile?.business_name ?? 'Merchant',
    sessionId
  })

  // Return sessionId in header so the client can reuse it
  const response = result.toDataStreamResponse()
  const headers = new Headers(response.headers)
  headers.set('x-session-id', sessionId)

  return new Response(response.body, { headers, status: response.status })
}
```


***

## Step 10 — Session List Route (for chat history sidebar)

**`apps/dashboard/app/api/agent/sessions/route.ts`:**

```typescript
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: sessions } = await supabase
    .from('agent_sessions')
    .select('id, title, created_at, updated_at, status')
    .eq('merchant_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(30)

  return Response.json(sessions ?? [])
}
```


***

## Step 11 — Dashboard Chat UI

**`apps/dashboard/components/agent/AgentChatPanel.tsx`:**

```tsx
'use client'

import { useChat } from '@ai-sdk/react'
import { useState, useRef, useEffect } from 'react'

interface Props {
  initialSessionId?: string
}

export function AgentChatPanel({ initialSessionId }: Props) {
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/agent/chat',
    body: { sessionId },
    onResponse: (response) => {
      // Capture session ID from first response so all turns share same session
      const sid = response.headers.get('x-session-id')
      if (sid && !sessionId) setSessionId(sid)
    }
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex flex-col h-full border-l bg-background">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-semibold">MerchantMind</span>
        </div>
        {sessionId && (
          <span className="text-xs text-muted-foreground font-mono">
            {sessionId.slice(0, 8)}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm space-y-1 pt-12">
            <p className="font-medium">How can I help today?</p>
            <p className="text-xs">Ask about orders, sales, or LHDN e-invoice rules.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed
              ${msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'}`}
            >
              {msg.parts?.map((part, i) => {
                if (part.type === 'tool-invocation' && part.state === 'call') {
                  return (
                    <p key={i} className="text-xs italic opacity-70 mb-1">
                      ⚙️ {part.toolName.replace(/_/g, ' ')}…
                    </p>
                  )
                }
                if (part.type === 'text') {
                  return <span key={i} className="whitespace-pre-wrap">{part.text}</span>
                }
                return null
              }) ?? <span className="whitespace-pre-wrap">{msg.content as string}</span>}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground animate-pulse">
              Thinking…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 border-t flex gap-2">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask MerchantMind…"
          disabled={isLoading}
          className="flex-1 text-sm rounded-lg border bg-background px-3 py-2
                     focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground
                     text-sm font-medium disabled:opacity-40 hover:bg-primary/90
                     transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}
```

**`apps/dashboard/components/agent/AgentSessionList.tsx`** (chat history sidebar):

```tsx
'use client'

import { useEffect, useState } from 'react'

interface Session {
  id: string; title: string; updated_at: string
}

interface Props {
  activeId?: string
  onSelect: (sessionId: string) => void
  onNewChat: () => void
}

export function AgentSessionList({ activeId, onSelect, onNewChat }: Props) {
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    fetch('/api/agent/sessions')
      .then(r => r.json())
      .then(setSessions)
  }, [])

  return (
    <div className="flex flex-col h-full border-r bg-background w-56">
      <div className="p-3 border-b">
        <button
          onClick={onNewChat}
          className="w-full text-sm px-3 py-2 rounded-lg bg-primary
                     text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + New Chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sessions.map(s => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left px-3 py-2.5 text-xs border-b hover:bg-muted
                        transition-colors truncate ${activeId === s.id ? 'bg-muted font-medium' : ''}`}
          >
            <p className="truncate font-medium text-foreground">{s.title ?? 'Untitled'}</p>
            <p className="text-muted-foreground mt-0.5">
              {new Date(s.updated_at).toLocaleDateString('en-MY')}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
```

**Compose them in your dashboard layout:**

```tsx
// apps/dashboard/app/(dashboard)/agent/page.tsx
'use client'

import { useState } from 'react'
import { AgentSessionList } from '@/components/agent/AgentSessionList'
import { AgentChatPanel }   from '@/components/agent/AgentChatPanel'

export default function AgentPage() {
  const [sessionId, setSessionId] = useState<string | undefined>()

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <AgentSessionList
        activeId={sessionId}
        onSelect={setSessionId}
        onNewChat={() => setSessionId(undefined)}
      />
      <div className="flex-1">
        <AgentChatPanel
          key={sessionId ?? 'new'}   // remount on session change
          initialSessionId={sessionId}
        />
      </div>
    </div>
  )
}
```


***

## Step 12 — Approval Queue UI

**`apps/dashboard/app/(dashboard)/agent/approvals/page.tsx`:**

```tsx
import { createClient } from '@/lib/supabase/server'

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const { data: approvals } = await supabase
    .from('agent_approvals')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-4">
      <h1 className="text-xl font-semibold">Pending Approvals</h1>
      {approvals?.length === 0 && (
        <p className="text-muted-foreground text-sm">No pending approvals.</p>
      )}
      {approvals?.map(a => (
        <div key={a.id} className="border rounded-xl p-4 space-y-3 bg-background">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-sm">{a.title}</p>
              <p className="text-muted-foreground text-xs mt-0.5">{a.description}</p>
            </div>
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5
                             rounded-full shrink-0 dark:bg-yellow-900 dark:text-yellow-200">
              {a.risk_level}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Requested {new Date(a.created_at).toLocaleString('en-MY')}
          </p>
          <div className="flex gap-2">
            <ApprovalButton approvalId={a.id} action="approve" />
            <ApprovalButton approvalId={a.id} action="reject" />
          </div>
        </div>
      ))}
    </div>
  )
}
```

Add a `/api/agent/approvals/[id]/route.ts` PATCH handler to update status and trigger the pending tool execution.

***

## Step 13 — LHDN Knowledge Base Setup

Download these documents from the official LHDN MyInvois portal and save to `packages/agent/docs/`:

- `lhdn-einvoice-guideline-v4.1.pdf`
- `lhdn-faq.pdf`
- `lhdn-implementation-phases.pdf`
- `malaysia-sst-codes.pdf`

**`packages/agent/scripts/setup-knowledge-base.ts`:**

```typescript
import { GoogleGenAI } from '@ai-sdk/google'
import fs from 'fs'
import path from 'path'

const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! })

const docs = [
  { file: 'lhdn-einvoice-guideline-v4.1.pdf', label: 'LHDN e-Invoice Guideline v4.1' },
  { file: 'lhdn-faq.pdf',                      label: 'LHDN e-Invoice FAQ' },
  { file: 'lhdn-implementation-phases.pdf',    label: 'LHDN Implementation Phases & Thresholds' },
  { file: 'malaysia-sst-codes.pdf',            label: 'Malaysia SST Tax Codes' }
]

async function main() {
  const store = await client.fileSearchStores.create({
    config: { display_name: 'malaysia-einvoice-knowledge' }
  })
  console.log('\n✅ Store created:', store.name)

  for (const doc of docs) {
    const filePath = path.join('./docs', doc.file)
    await client.fileSearchStores.uploadToFileSearchStore({
      file:                 fs.createReadStream(filePath),
      fileSearchStoreName:  store.name,
      config:               { display_name: doc.label }
    })
    console.log('✅ Uploaded:', doc.label)
  }

  console.log('\n📋 Add to your .env:')
  console.log(`GEMINI_FILE_SEARCH_STORE_ID=${store.name}`)
}

main()
```

Run once: `pnpm tsx packages/agent/scripts/setup-knowledge-base.ts`

***

## Step 14 — Environment Variables

```bash
# Google AI (Gemini + File Search)
GOOGLE_AI_API_KEY=AIza...
GEMINI_FILE_SEARCH_STORE_ID=fileSearchStores/...

# Supabase (already in project)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```


***

## Phase 1 Completion Checklist

- [ ] `packages/agent` added to pnpm workspace and resolves from `apps/dashboard`
- [ ] All 5 Supabase tables migrated with RLS policies verified
- [ ] `match_agent_memory` SQL function created
- [ ] Tool executor middleware handles low, medium, and high risk correctly
- [ ] 5 starter tools implemented and callable
- [ ] Message history persists to `agent_messages` and reloads correctly on refresh
- [ ] Session list shows in sidebar with correct titles
- [ ] New chat creates a new session; switching sessions loads correct history
- [ ] `/api/agent/chat` rejects unauthenticated requests with 401
- [ ] `x-session-id` header returned on first response and reused for subsequent turns
- [ ] Orchestrator wired to Gemini 2.5 Flash with File Search store ID
- [ ] `search_knowledge_base` returns grounded LHDN answer with source citation
- [ ] `cancel_order` creates an `agent_approvals` row instead of executing
- [ ] Approvals page shows pending approvals with Approve/Reject buttons
- [ ] LHDN setup script runs without error, all 4 documents uploaded
- [ ] End-to-end test: "how many orders today?" → correct count from DB
- [ ] End-to-end test: "what is the LHDN threshold for mandatory e-invoicing?" → cited answer
- [ ] End-to-end test: "cancel order \#SHP-001" → routes to approval queue, does not cancel immediately

