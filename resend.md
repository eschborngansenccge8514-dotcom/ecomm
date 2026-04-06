# Resend Integration Plan — Hyperlocal Merchant Operating System

## Overview

This document provides a full implementation plan for integrating **Resend** as the transactional email provider across the Hyperlocal Merchant Operating System monorepo. Given the platform's architecture — a pnpm monorepo with a Next.js 16 dashboard, an Expo mobile consumer app, Supabase Edge Functions (Deno), and a Cloudflare Workers aggregator — Resend is the ideal choice because it supports Node.js, Deno-native `fetch`, and provides a React Email-first template authoring experience.

The integration is split across three distinct delivery surfaces: a shared `packages/email` package for templates and the Resend client, Next.js App Router API routes for dashboard-triggered sends, and Supabase Edge Functions triggered by database webhooks for event-driven sends. Supabase Auth will also be configured to route all authentication emails (OTPs, magic links, password resets) through Resend.

---

## Phase 1 — Shared Email Package (`packages/email`)

All React Email templates and the Resend client instance live in a shared internal package to avoid duplication across apps.

### 1.1 Package Scaffold

Create the package at `packages/email/`:

```
packages/email/
├── package.json
├── tsconfig.json
├── src/
│   ├── client.ts               # Resend client singleton
│   ├── send.ts                 # Typed send wrapper
│   ├── templates/
│   │   ├── order-confirmation.tsx
│   │   ├── order-status-update.tsx
│   │   ├── merchant-new-order.tsx
│   │   ├── low-stock-alert.tsx
│   │   ├── merchant-welcome.tsx
│   │   └── consumer-welcome.tsx
│   └── index.ts
```

`package.json`:

```json
{
  "name": "@repo/email",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "@react-email/components": "latest",
    "react-email": "latest",
    "resend": "^4.0.0"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

Add to `pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'   # already present — no change needed
```

### 1.2 Resend Client Singleton (`src/client.ts`)

```typescript
import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not set');
}

export const resend = new Resend(process.env.RESEND_API_KEY);

export const FROM_ADDRESSES = {
  transactional: 'Hyperlocal <orders@mail.yourdomain.com>',
  merchant:      'Merchant Hub <merchant@mail.yourdomain.com>',
  support:       'Support <support@mail.yourdomain.com>',
  noreply:       'No Reply <noreply@mail.yourdomain.com>',
} as const;
```

### 1.3 Typed Send Wrapper (`src/send.ts`)

A unified wrapper with consistent error logging used by all callers:

```typescript
import { resend } from './client';
import type { CreateEmailOptions } from 'resend';

export type SendResult =
  | { success: true; id: string }
  | { success: false; error: string };

export async function sendEmail(
  options: CreateEmailOptions
): Promise<SendResult> {
  try {
    const { data, error } = await resend.emails.send(options);
    if (error) return { success: false, error: error.message };
    return { success: true, id: data!.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[resend] send failed:', message);
    return { success: false, error: message };
  }
}
```

### 1.4 Example React Email Template

`src/templates/order-confirmation.tsx` — representative template for consumer order confirmation:

```tsx
import {
  Body, Container, Head, Heading, Hr, Html,
  Preview, Section, Text, Button,
} from '@react-email/components';

interface OrderConfirmationProps {
  customerName: string;
  orderId: string;
  merchantName: string;
  orderTotal: string;
  trackingUrl: string;
  lineItems: Array<{ name: string; qty: number; price: string }>;
}

export function OrderConfirmationEmail({
  customerName,
  orderId,
  merchantName,
  orderTotal,
  trackingUrl,
  lineItems,
}: OrderConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>Your order from {merchantName} is confirmed!</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f7f6f2' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
          <Heading>Order Confirmed 🎉</Heading>
          <Text>Hi {customerName}, your order #{orderId} from <strong>{merchantName}</strong> has been confirmed.</Text>
          <Hr />
          <Section>
            {lineItems.map((item) => (
              <Text key={item.name}>
                {item.name} × {item.qty} — {item.price}
              </Text>
            ))}
          </Section>
          <Hr />
          <Text><strong>Total: {orderTotal}</strong></Text>
          <Button href={trackingUrl} style={{ background: '#01696f', color: '#fff', padding: '12px 24px', borderRadius: '6px' }}>
            Track Your Order
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
```

All other templates follow the same pattern. Refer to the Email Catalogue section below for full template inventory and props.

---

## Phase 2 — Domain & DNS Setup

Before any email can be sent to real users, a sending domain must be verified in Resend.

1. Log in to [resend.com](https://resend.com) and navigate to **Domains** → **Add Domain**.
2. Use a subdomain such as `mail.yourdomain.com` to keep SPF/DKIM isolated from the root domain.
3. Add the DNS records Resend generates (MX, SPF TXT, DKIM CNAME) to your DNS provider.
4. Wait for verification (typically under 30 minutes).
5. Set `FROM_ADDRESSES` in `packages/email/src/client.ts` to use `@mail.yourdomain.com`.

---

## Phase 3 — Supabase Auth Email Routing

Supabase ships with its own built-in email service, but it has rate limits and no custom domain support. Configuring Resend as the SMTP relay gives full control over authentication emails (magic links, OTPs, password resets) sent to both merchants and consumers.

### 3.1 Enable Custom SMTP in Supabase Dashboard

1. Go to **Authentication** → **Providers** → **Email** in your Supabase project dashboard.
2. Scroll to **SMTP Settings** and enable **Custom SMTP**.
3. Fill in the following:

| Field | Value |
|-------|-------|
| **Host** | `smtp.resend.com` |
| **Port** | `465` (SSL) or `587` (STARTTLS) |
| **Username** | `resend` |
| **Password** | Your Resend API key (`re_...`) |
| **Sender name** | `Hyperlocal` |
| **Sender email** | `noreply@mail.yourdomain.com` |

4. Save, then trigger a test email from the Supabase dashboard to confirm delivery.

> **Note**: Supabase Auth's email templates (magic link, OTP, etc.) are configured separately under **Authentication** → **Email Templates**. Customise the HTML there to match your brand, since Supabase injects its own `{{ .ConfirmationURL }}` variables before relaying via SMTP.

---

## Phase 4 — Next.js Dashboard Integration (`apps/dashboard`)

The Merchant Dashboard uses Next.js 16 App Router. Email sends triggered by user actions call internal API route handlers, while background sends from server-side business logic use Server Actions.

### 4.1 Install Package in Dashboard

```bash
pnpm --filter dashboard add @repo/email
```

Add `RESEND_API_KEY` to `apps/dashboard/.env.local`:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
```

### 4.2 API Route — Merchant Welcome

`apps/dashboard/app/api/email/merchant-welcome/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, FROM_ADDRESSES } from '@repo/email';
import { MerchantWelcomeEmail } from '@repo/email/templates/merchant-welcome';

export async function POST(req: NextRequest) {
  const { merchantEmail, merchantName, dashboardUrl } = await req.json();

  const result = await sendEmail({
    from: FROM_ADDRESSES.merchant,
    to: merchantEmail,
    subject: `Welcome to Hyperlocal, ${merchantName}!`,
    react: MerchantWelcomeEmail({ merchantName, dashboardUrl }),
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ id: result.id });
}
```

### 4.3 Email Dashboard Page

An internal admin page at `apps/dashboard/app/(dashboard)/email/page.tsx` surfaces the `email_logs` table as a searchable, filterable log. It gives operators visibility into delivery health without leaving the Merchant Dashboard.

#### File structure

```
apps/dashboard/app/(dashboard)/email/
├── page.tsx                  # Server component — fetches KPI stats + initial log rows
├── email-log-table.tsx       # Client component — TanStack Table with filters
└── _data/
    └── queries.ts            # Supabase data-fetching helpers
```

#### Data queries (`_data/queries.ts`)

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export type EmailLog = {
  id: string;
  resend_id: string | null;
  template: string;
  recipient: string;
  status: 'sent' | 'failed' | 'delivered' | 'bounced' | 'complained';
  error: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type EmailKpis = {
  total: number;
  delivered: number;
  failed: number;
  bounced: number;
};

function createClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => cookies().getAll() } }
  );
}

export async function getEmailKpis(): Promise<EmailKpis> {
  const supabase = createClient();
  const { data } = await supabase
    .from('email_logs')
    .select('status');

  const rows = data ?? [];
  return {
    total:     rows.length,
    delivered: rows.filter((r) => r.status === 'delivered').length,
    failed:    rows.filter((r) => r.status === 'failed').length,
    bounced:   rows.filter((r) => r.status === 'bounced').length,
  };
}

export async function getEmailLogs(opts?: {
  status?: string;
  template?: string;
  limit?: number;
}): Promise<EmailLog[]> {
  const supabase = createClient();
  let query = supabase
    .from('email_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.status)   query = query.eq('status', opts.status);
  if (opts?.template) query = query.eq('template', opts.template);

  const { data } = await query;
  return (data ?? []) as EmailLog[];
}
```

#### Page server component (`page.tsx`)

```tsx
import { getEmailKpis, getEmailLogs } from './_data/queries';
import { EmailLogTable } from './email-log-table';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Email Logs' };

// Revalidate every 60 seconds so KPIs stay reasonably fresh
export const revalidate = 60;

export default async function EmailDashboardPage() {
  const [kpis, logs] = await Promise.all([getEmailKpis(), getEmailLogs()]);

  const deliveryRate =
    kpis.total > 0 ? ((kpis.delivered / kpis.total) * 100).toFixed(1) : '—';

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Email Logs</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Sent',     value: kpis.total,     variant: 'secondary' },
          { label: 'Delivered',      value: kpis.delivered, variant: 'success'   },
          { label: 'Failed',         value: kpis.failed,    variant: 'error'     },
          { label: 'Bounced',        value: kpis.bounced,   variant: 'warning'   },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Delivery rate: <strong>{deliveryRate}%</strong>
      </p>

      {/* Log Table */}
      <EmailLogTable initialData={logs} />
    </div>
  );
}
```

#### Log table client component (`email-log-table.tsx`)

Uses TanStack Table (already a dependency in `apps/dashboard`) with column filters for **status** and **template**, plus a free-text search on **recipient**.

```tsx
'use client';

import { useState, useMemo } from 'react';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  getSortedRowModel, flexRender,
  type ColumnDef, type ColumnFiltersState,
} from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { EmailLog } from './_data/queries';

const STATUS_VARIANTS: Record<string, string> = {
  sent:       'secondary',
  delivered:  'success',
  failed:     'destructive',
  bounced:    'warning',
  complained: 'warning',
};

const COLUMNS: ColumnDef<EmailLog>[] = [
  {
    accessorKey: 'created_at',
    header: 'Time',
    cell: ({ getValue }) =>
      new Date(getValue<string>()).toLocaleString('en-MY', {
        dateStyle: 'short', timeStyle: 'short',
      }),
  },
  { accessorKey: 'template',  header: 'Template'  },
  { accessorKey: 'recipient', header: 'Recipient' },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => {
      const s = getValue<string>();
      return <Badge variant={STATUS_VARIANTS[s] as any}>{s}</Badge>;
    },
  },
  {
    accessorKey: 'error',
    header: 'Error',
    cell: ({ getValue }) => (
      <span className="text-xs text-muted-foreground">{getValue<string>() ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'resend_id',
    header: 'Resend ID',
    cell: ({ getValue }) => (
      <code className="text-xs">{getValue<string>() ?? '—'}</code>
    ),
  },
];

// Unique template names derived from data
function useTemplateOptions(data: EmailLog[]) {
  return useMemo(
    () => Array.from(new Set(data.map((r) => r.template))).sort(),
    [data]
  );
}

export function EmailLogTable({ initialData }: { initialData: EmailLog[] }) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const templateOptions = useTemplateOptions(initialData);

  const table = useReactTable({
    data: initialData,
    columns: COLUMNS,
    state: { columnFilters, globalFilter },
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { sorting: [{ id: 'created_at', desc: true }] },
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search recipient…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="w-56"
        />

        <Select
          onValueChange={(v) =>
            setColumnFilters((prev) => [
              ...prev.filter((f) => f.id !== 'status'),
              ...(v === 'all' ? [] : [{ id: 'status', value: v }]),
            ])
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {['sent', 'delivered', 'failed', 'bounced', 'complained'].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          onValueChange={(v) =>
            setColumnFilters((prev) => [
              ...prev.filter((f) => f.id !== 'template'),
              ...(v === 'all' ? [] : [{ id: 'template', value: v }]),
            ])
          }
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All templates" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All templates</SelectItem>
            {templateOptions.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} className="py-12 text-center text-muted-foreground">
                  No email logs found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.def, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {table.getRowModel().rows.length} of {initialData.length} logs
      </p>
    </div>
  );
}
```

#### Add the nav link

Add `Email Logs` to the sidebar nav in `apps/dashboard/components/sidebar.tsx` (or equivalent):

```typescript
{ label: 'Email Logs', href: '/email', icon: 'mail' },
```

---

## Phase 5 — Supabase Edge Functions (Event-Driven Emails)

Order lifecycle and inventory alerts are best triggered by **Supabase Database Webhooks** firing Supabase Edge Functions. Edge Functions run Deno, which does not support Node.js packages — use the Resend HTTP REST API directly via `fetch`.

### 5.1 Edge Function — Order Confirmation

`supabase/functions/email-order-confirmation/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM = 'Hyperlocal <orders@mail.yourdomain.com>';

interface OrderRow {
  id: string;
  customer_email: string;
  customer_name: string;
  merchant_name: string;
  total_amount: number;
  currency: string;
  line_items: Array<{ name: string; qty: number; unit_price: number }>;
}

serve(async (req) => {
  const payload = await req.json();
  const order: OrderRow = payload.record; // Supabase webhook payload

  const lineItemsHtml = order.line_items
    .map((i) => `<li>${i.name} × ${i.qty} — ${order.currency} ${i.unit_price.toFixed(2)}</li>`)
    .join('');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: order.customer_email,
      subject: `Order Confirmed — #${order.id}`,
      html: `
        <h2>Hi ${order.customer_name}!</h2>
        <p>Your order from <strong>${order.merchant_name}</strong> has been confirmed.</p>
        <ul>${lineItemsHtml}</ul>
        <p><strong>Total: ${order.currency} ${order.total_amount.toFixed(2)}</strong></p>
      `,
    }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
```

> **Tip**: For richer HTML in Edge Functions without Node.js, pre-render React Email templates in the dashboard at build time and store the HTML string in `supabase/functions/shared/templates/` as a plain string export. The Edge Function imports the string and interpolates variables.

### 5.2 Database Webhooks to Wire

Set up the following webhooks in **Supabase Dashboard → Database → Webhooks**:

| Trigger Table | Event | Edge Function | Email Sent |
|---|---|---|---|
| `orders` | `INSERT` | `email-order-confirmation` | Consumer order confirmation |
| `orders` | `UPDATE` (status) | `email-order-status-update` | Consumer order status update |
| `orders` | `INSERT` | `email-merchant-new-order` | Merchant new order alert |
| `inventory_items` | `UPDATE` (stock ≤ threshold) | `email-low-stock-alert` | Merchant low stock alert |
| `auth.users` | `INSERT` | `email-consumer-welcome` | Consumer welcome email |

### 5.3 Store the API Key as a Secret

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
```

Then deploy each function:

```bash
supabase functions deploy email-order-confirmation
supabase functions deploy email-order-status-update
supabase functions deploy email-merchant-new-order
supabase functions deploy email-low-stock-alert
supabase functions deploy email-consumer-welcome
```

---

## Phase 6 — Environment Variables

Centralise all environment variable requirements. Never commit actual values to the repository.

### `apps/dashboard/.env.local`

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
```

### Supabase Secrets (set via CLI)

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
```

### Vercel / Deployment Platform

Add `RESEND_API_KEY` under **Settings → Environment Variables** for all environments (Production, Preview, Development).

---

## Email Catalogue

Full inventory of email types, the surface that sends them, and the trigger mechanism:

| Email | Recipient | Sender Surface | Trigger |
|---|---|---|---|
| Order Confirmation | Consumer | Supabase Edge Function | DB Webhook — `orders INSERT` |
| Order Status Update (packed / shipped / delivered) | Consumer | Supabase Edge Function | DB Webhook — `orders UPDATE` |
| Merchant: New Order Alert | Merchant | Supabase Edge Function | DB Webhook — `orders INSERT` |
| Low Stock Alert | Merchant | Supabase Edge Function | DB Webhook — `inventory_items UPDATE` |
| Merchant Welcome / Onboarding | Merchant | Next.js API Route | Merchant registration event |
| Consumer Welcome | Consumer | Supabase Edge Function | DB Webhook — `auth.users INSERT` |
| Magic Link / OTP / Password Reset | Merchant / Consumer | Supabase Auth SMTP | Auth action |

---

## Phase 7 — Local Development & Preview

React Email ships with a local dev server to preview and iterate on templates before shipping.

### 7.1 Start the React Email Preview Server

Add a dev script to `packages/email/package.json`:

```json
{
  "scripts": {
    "dev": "react-email dev --dir src/templates --port 3100"
  }
}
```

Run from the monorepo root:

```bash
pnpm --filter @repo/email dev
```

This opens `http://localhost:3100` with a live preview of all templates.

### 7.2 Test Send with Resend's Test Mode

Resend supports sending to `delivered@resend.dev` during development for safe testing without hitting real inboxes. Replace the `to` address in local `.env` overrides:

```env
# apps/dashboard/.env.local
EMAIL_OVERRIDE_TO=delivered@resend.dev  # override all outgoing emails in dev
```

Add a guard in `packages/email/src/send.ts`:

```typescript
const toOverride = process.env.EMAIL_OVERRIDE_TO;

export async function sendEmail(options: CreateEmailOptions): Promise<SendResult> {
  const finalOptions = toOverride
    ? { ...options, to: toOverride }
    : options;
  // ... rest of send logic
}
```

---

## Phase 8 — Error Handling & Observability

### 8.1 Retry Logic

Wrap all sends in a simple exponential retry for transient failures:

```typescript
// packages/email/src/send.ts
async function sendWithRetry(
  options: CreateEmailOptions,
  retries = 3
): Promise<SendResult> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const result = await sendEmail(options);
    if (result.success) return result;
    if (attempt < retries) await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
  }
  return { success: false, error: 'Max retries exceeded' };
}
```

### 8.2 Logging Email Send Events

Log all email send attempts to an `email_logs` Supabase table for audit trails:

```sql
CREATE TABLE email_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_id   TEXT,
  template    TEXT NOT NULL,
  recipient   TEXT NOT NULL,
  status      TEXT NOT NULL,  -- 'sent' | 'delivered' | 'failed' | 'bounced' | 'complained'
  error       TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

Update `send.ts` to insert a row after every send attempt using the Supabase service role client.

### 8.3 Webhook for Delivery Events

Resend pushes delivery, bounce, and complaint events back via webhooks. Register a webhook endpoint pointing to the `apps/functions-worker` Cloudflare Worker (which already handles webhooks):

```
https://your-worker.workers.dev/webhooks/resend
```

In the worker, add a `/webhooks/resend` route that updates the `status` column on the corresponding `email_logs` row using the `resend_id` as the lookup key. This is what populates the **Delivered**, **Bounced**, and **Complained** statuses visible in the Email Dashboard.

```typescript
// apps/functions-worker/src/routes/webhooks/resend.ts
export async function handleResendWebhook(req: Request, env: Env) {
  const event = await req.json<{
    type: 'email.delivered' | 'email.bounced' | 'email.complained' | 'email.failed';
    data: { email_id: string };
  }>();

  const statusMap: Record<string, string> = {
    'email.delivered':  'delivered',
    'email.bounced':    'bounced',
    'email.complained': 'complained',
    'email.failed':     'failed',
  };

  const newStatus = statusMap[event.type];
  if (!newStatus) return new Response('ignored', { status: 200 });

  await fetch(`${env.SUPABASE_URL}/rest/v1/email_logs?resend_id=eq.${event.data.email_id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ status: newStatus }),
  });

  return new Response('ok', { status: 200 });
}
```

---

## Implementation Checklist

- [ ] Create `packages/email` with `package.json`, `tsconfig.json`, `src/client.ts`, `src/send.ts`, `src/index.ts`
- [ ] Build all 6 React Email templates in `packages/email/src/templates/`
- [ ] Add `@repo/email` as a dependency in `apps/dashboard`
- [ ] Verify sending domain `mail.yourdomain.com` in Resend dashboard and add DNS records
- [ ] Set `RESEND_API_KEY` in `apps/dashboard/.env.local` and Vercel environment variables
- [ ] Configure Supabase SMTP to point to Resend (`smtp.resend.com:465`, API key as password)
- [ ] Customise Supabase Auth email templates under Authentication → Email Templates
- [ ] Create 5 Supabase Edge Functions for event-driven emails
- [ ] Set `RESEND_API_KEY` Supabase secret via CLI
- [ ] Wire Database Webhooks in Supabase Dashboard for all 5 trigger events
- [ ] Add Next.js API route for merchant welcome email
- [ ] Create `email_logs` Supabase table with migration
- [ ] Build Email Dashboard page at `app/(dashboard)/email/page.tsx` (KPI cards + log table)
- [ ] Add `Email Logs` entry to the sidebar nav
- [ ] Add Resend delivery webhook handler to `apps/functions-worker`
- [ ] Add `EMAIL_OVERRIDE_TO` guard in `send.ts` for safe development testing
- [ ] Update `send.ts` to log every send attempt to `email_logs`
- [ ] Run `pnpm --filter @repo/email dev` and visually verify all templates
