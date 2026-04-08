# Accounting Automation Implementation Plan — Hyperlocal Merchant Operating System

## Overview

This plan details the full implementation of **automated accounting** for the Hyperlocal Merchant Operating System. Rather than requiring merchants to manually record transactions, the system uses four automation layers to keep the books up-to-date in real time with zero manual entry for day-to-day operations.

The four automation layers are:

| Layer | Mechanism | What it automates |
|---|---|---|
| **1. Event-Driven Auto-Posting** | Supabase DB Webhooks → Edge Functions | Sales, purchases, payments, refunds |
| **2. Recurring Entries** | Supabase `pg_cron` | Rent, subscriptions, depreciation |
| **3. AI Categorisation** | Gemini SDK + Supabase Storage trigger | Receipt OCR, expense categorisation |
| **4. Automated Reports & Alerts** | `pg_cron` + Resend | Monthly P&L email, SST filing reminders |

The implementation builds entirely on infrastructure already present in the monorepo: Supabase Edge Functions and DB webhooks, the Gemini AI SDK in `packages/agent`, the Resend email package in `packages/email`, and the `pg_cron` extension already available on all Supabase projects.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      TRIGGER SOURCES                          │
│  Sales Orders  │  Purchase Orders  │  Payments  │  Refunds   │
└───────────────────────────┬──────────────────────────────────┘
                            │  DB Webhooks
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                SUPABASE EDGE FUNCTIONS                        │
│  accounting-post-sale        │  accounting-post-purchase      │
│  accounting-post-payment     │  accounting-post-refund        │
│  accounting-post-recurring   │  (fired by pg_cron monthly)    │
│  accounting-categorise-receipt (fired by Storage trigger)     │
│  email-monthly-report        │  (fired by pg_cron monthly)    │
│  email-sst-reminder          │  (fired by pg_cron bi-monthly) │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                  JOURNAL ENTRIES TABLE                        │
│  Auto-posted  │  Recurring  │  AI-suggested  │  Manual       │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                    AUTOMATED OUTPUTS                          │
│  Real-time P&L  │  Balance Sheet  │  Monthly report emails   │
│  SST filing summaries  │  Unreviewed receipt queue           │
└──────────────────────────────────────────────────────────────┘
```

---

## Phase 1 — Event-Driven Auto-Posting

The most impactful automation layer. Every financial event across the platform automatically creates a balanced, posted journal entry without any merchant interaction.

### 1.1 Webhook Map

Set up the following in **Supabase Dashboard → Database → Webhooks**:

| Trigger Table | Condition | Edge Function | Journal Pattern |
|---|---|---|---|
| `orders` | `UPDATE` where `status = 'completed'` | `accounting-post-sale` | DR Accounts Receivable / CR Sales Revenue + SST Payable |
| `purchase_orders` | `UPDATE` where `status = 'received'` | `accounting-post-purchase` | DR Inventory + SST Receivable / CR Accounts Payable |
| `payments` | `INSERT` | `accounting-post-payment` | DR Bank Account / CR Accounts Receivable |
| `refunds` | `INSERT` | `accounting-post-refund` | DR Sales Revenue + SST Payable / CR Accounts Receivable |

### 1.2 Shared Edge Function Utility

Create a shared utility module all four Edge Functions import for journal creation:

`supabase/functions/_shared/journal-writer.ts`:

```typescript
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type JournalLine = {
  account_code: string;
  description:  string;
  debit:        number;
  credit:       number;
};

export async function writeJournal(
  supabase: SupabaseClient,
  params: {
    merchantId:  string;
    source:      string;
    sourceId:    string;
    description: string;
    entryDate:   string;
    currency:    string;
    lines:       JournalLine[];
  }
): Promise<{ success: boolean; entryId?: string; error?: string }> {
  // Resolve account codes to IDs for this merchant
  const codes = params.lines.map((l) => l.account_code);
  const { data: accts, error: acctErr } = await supabase
    .from('accounts')
    .select('id, code')
    .eq('merchant_id', params.merchantId)
    .in('code', codes);

  if (acctErr || !accts?.length) {
    return { success: false, error: 'Could not resolve account codes' };
  }

  const byCode = Object.fromEntries(accts.map((a) => [a.code, a.id]));

  // Validate balance before inserting
  const totalDebit  = params.lines.reduce((s, l) => s + l.debit,  0);
  const totalCredit = params.lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    return { success: false, error: `Unbalanced entry: DR ${totalDebit} ≠ CR ${totalCredit}` };
  }

  // Generate JE number
  const { data: seqData } = await supabase.rpc('generate_journal_number');
  const entryNumber = seqData as string;

  // Insert journal entry header
  const { data: je, error: jeErr } = await supabase
    .from('journal_entries')
    .insert({
      merchant_id:  params.merchantId,
      entry_number: entryNumber,
      status:       'posted',
      source:       params.source,
      source_id:    params.sourceId,
      description:  params.description,
      entry_date:   params.entryDate,
      currency:     params.currency,
    })
    .select()
    .single();

  if (jeErr) return { success: false, error: jeErr.message };

  // Insert journal lines
  const { error: lineErr } = await supabase
    .from('journal_entry_lines')
    .insert(
      params.lines.map((l, i) => ({
        journal_entry_id: je.id,
        account_id:       byCode[l.account_code],
        description:      l.description,
        debit:            String(l.debit),
        credit:           String(l.credit),
        line_order:       i,
      }))
    );

  if (lineErr) return { success: false, error: lineErr.message };

  return { success: true, entryId: je.id };
}
```

### 1.3 Edge Function — Sales Order Auto-Post

`supabase/functions/accounting-post-sale/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { writeJournal } from '../_shared/journal-writer.ts';

serve(async (req) => {
  const { record: order, old_record } = await req.json();

  // Only fire when status transitions TO 'completed'
  if (order.status !== 'completed' || old_record?.status === 'completed') {
    return new Response('skip', { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const subtotal   = Number(order.subtotal);
  const taxAmount  = Number(order.tax_amount);
  const total      = Number(order.total_amount);

  const lines = [
    // DR Accounts Receivable (asset increases)
    { account_code: '1100', description: `Sale ${order.order_number}`, debit: total,    credit: 0 },
    // CR Sales Revenue (revenue increases)
    { account_code: '4000', description: `Sale ${order.order_number}`, debit: 0, credit: subtotal },
  ];

  // CR SST Payable only if tax was charged
  if (taxAmount > 0) {
    lines.push({
      account_code: '2100',
      description:  `SST on ${order.order_number}`,
      debit: 0, credit: taxAmount,
    });
  }

  const result = await writeJournal(supabase, {
    merchantId:  order.merchant_id,
    source:      'sales_order',
    sourceId:    order.id,
    description: `Customer Order #${order.order_number}`,
    entryDate:   order.completed_at ?? new Date().toISOString(),
    currency:    order.currency ?? 'MYR',
    lines,
  });

  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### 1.4 Edge Function — Purchase Order Auto-Post

`supabase/functions/accounting-post-purchase/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { writeJournal } from '../_shared/journal-writer.ts';

serve(async (req) => {
  const { record: po, old_record } = await req.json();

  if (po.status !== 'received' || old_record?.status === 'received') {
    return new Response('skip', { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const total     = Number(po.total_amount);
  const taxAmount = Number(po.tax_amount);
  const netCost   = total - taxAmount;

  const lines = [
    // DR Inventory (asset increases)
    { account_code: '1200', description: `PO ${po.po_number}`, debit: netCost, credit: 0 },
    // CR Accounts Payable (liability increases)
    { account_code: '2000', description: `PO ${po.po_number}`, debit: 0, credit: total },
  ];

  // DR SST Receivable (input tax, only if applicable)
  if (taxAmount > 0) {
    lines.push({
      account_code: '1300',
      description:  `Input Tax ${po.po_number}`,
      debit: taxAmount, credit: 0,
    });
  }

  const result = await writeJournal(supabase, {
    merchantId:  po.merchant_id,
    source:      'purchase_order',
    sourceId:    po.id,
    description: `Purchase Order ${po.po_number}`,
    entryDate:   po.received_at ?? new Date().toISOString(),
    currency:    po.currency ?? 'MYR',
    lines,
  });

  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### 1.5 Edge Function — Payment Received Auto-Post

`supabase/functions/accounting-post-payment/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { writeJournal } from '../_shared/journal-writer.ts';

serve(async (req) => {
  const { record: payment } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const result = await writeJournal(supabase, {
    merchantId:  payment.merchant_id,
    source:      'payment_received',
    sourceId:    payment.id,
    description: `Payment via ${payment.gateway} for Order #${payment.order_number}`,
    entryDate:   payment.paid_at ?? new Date().toISOString(),
    currency:    payment.currency ?? 'MYR',
    lines: [
      // DR Bank Account (cash comes in)
      { account_code: '1010', description: `Payment ${payment.reference}`, debit: Number(payment.amount), credit: 0 },
      // CR Accounts Receivable (debt cleared)
      { account_code: '1100', description: `Payment ${payment.reference}`, debit: 0, credit: Number(payment.amount) },
    ],
  });

  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### 1.6 Edge Function — Refund Auto-Post

`supabase/functions/accounting-post-refund/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { writeJournal } from '../_shared/journal-writer.ts';

serve(async (req) => {
  const { record: refund } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const total     = Number(refund.amount);
  const taxAmount = Number(refund.tax_amount ?? 0);
  const subtotal  = total - taxAmount;

  const lines = [
    // DR Sales Revenue (reverses the original sale revenue)
    { account_code: '4000', description: `Refund ${refund.reference}`, debit: subtotal, credit: 0 },
    // CR Accounts Receivable (amount owed back to customer)
    { account_code: '1100', description: `Refund ${refund.reference}`, debit: 0, credit: total },
  ];

  // DR SST Payable (reverses the SST collected)
  if (taxAmount > 0) {
    lines.push({
      account_code: '2100',
      description:  `SST Reversal ${refund.reference}`,
      debit: taxAmount, credit: 0,
    });
  }

  const result = await writeJournal(supabase, {
    merchantId:  refund.merchant_id,
    source:      'refund',
    sourceId:    refund.id,
    description: `Refund for Order #${refund.order_number}`,
    entryDate:   refund.created_at,
    currency:    refund.currency ?? 'MYR',
    lines,
  });

  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### 1.7 Deploy All Four Functions

```bash
supabase functions deploy accounting-post-sale
supabase functions deploy accounting-post-purchase
supabase functions deploy accounting-post-payment
supabase functions deploy accounting-post-refund
```

---

## Phase 2 — Recurring Journal Entries (`pg_cron`)

Merchants configure fixed recurring expenses once (rent, subscriptions, depreciation) and the system automatically creates and posts the journal entries on schedule. Supabase's native `pg_cron` extension runs SQL jobs directly inside Postgres on any schedule. [web:101][web:104]

### 2.1 Recurring Templates Table

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_recurring_journals.sql

CREATE TABLE recurring_journal_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,               -- e.g. "Monthly Office Rent"
  description   TEXT NOT NULL,               -- description stamped on the JE
  cron_schedule TEXT NOT NULL,               -- standard cron syntax
  currency      TEXT NOT NULL DEFAULT 'MYR',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  lines         JSONB   NOT NULL,            -- Array<{ account_code, debit, credit, description }>
  last_run_at   TIMESTAMPTZ,
  next_run_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX recurring_merchant_idx ON recurring_journal_templates(merchant_id);
CREATE INDEX recurring_active_idx   ON recurring_journal_templates(is_active, next_run_at);
```

Example row for monthly rent:

```json
{
  "name": "Monthly Office Rent",
  "cron_schedule": "0 0 1 * *",
  "lines": [
    { "account_code": "5500", "description": "Rent — office", "debit": 3000, "credit": 0 },
    { "account_code": "1010", "description": "Rent — office", "debit": 0,    "credit": 3000 }
  ]
}
```

### 2.2 Cron Schedule Examples for Merchants

| Use Case | Cron Expression | Fires |
|---|---|---|
| Monthly rent | `0 0 1 * *` | 1st of every month, midnight |
| Weekly payroll | `0 9 * * 1` | Every Monday at 9 AM |
| Quarterly depreciation | `0 0 1 1,4,7,10 *` | 1st of Jan, Apr, Jul, Oct |
| Software subscription (15th) | `0 0 15 * *` | 15th of every month |
| Annual insurance | `0 0 1 1 *` | 1st January every year |

### 2.3 Cron Job Registration

Register a single master cron job that runs every minute and dispatches due recurring entries:

```sql
-- Enable pg_cron (already available on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Run every minute, check for due recurring templates
SELECT cron.schedule(
  'process-recurring-journals',
  '* * * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url')
                   || '/functions/v1/accounting-post-recurring',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{}'::jsonb
    ) AS request_id;
  $$
);
```

### 2.4 Edge Function — Process Recurring Entries

`supabase/functions/accounting-post-recurring/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { writeJournal } from '../_shared/journal-writer.ts';

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Fetch all active templates due to run
  const now = new Date().toISOString();
  const { data: templates } = await supabase
    .from('recurring_journal_templates')
    .select('*')
    .eq('is_active', true)
    .lte('next_run_at', now);

  if (!templates?.length) {
    return new Response('no templates due', { status: 200 });
  }

  const results = await Promise.allSettled(
    templates.map(async (template) => {
      const result = await writeJournal(supabase, {
        merchantId:  template.merchant_id,
        source:      'adjustment', // uses closest available source enum
        sourceId:    template.id,
        description: template.description,
        entryDate:   now,
        currency:    template.currency,
        lines:       template.lines,
      });

      if (result.success) {
        // Update last_run and compute next_run based on cron schedule
        await supabase
          .from('recurring_journal_templates')
          .update({
            last_run_at: now,
            next_run_at: computeNextRun(template.cron_schedule),
          })
          .eq('id', template.id);
      }

      return result;
    })
  );

  const summary = {
    total:   results.length,
    success: results.filter((r) => r.status === 'fulfilled').length,
    failed:  results.filter((r) => r.status === 'rejected').length,
  };

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

function computeNextRun(cronExpression: string): string {
  // Use a Deno-compatible cron parser
  // e.g. https://deno.land/x/cron_parser
  // Returns next Date as ISO string
  return new Date().toISOString(); // placeholder — replace with actual cron parser
}
```

### 2.5 Dashboard UI — Recurring Templates Manager

Add a page at `apps/dashboard/app/(dashboard)/accounting/recurring/page.tsx` where merchants manage their templates:

```tsx
// Recurring templates page — server component
import { getRecurringTemplates } from '@/lib/accounting/queries';
import { RecurringTemplatesTable } from './_components/recurring-templates-table';
import { AddRecurringButton } from './_components/add-recurring-button';

export default async function RecurringPage() {
  const merchantId = await getMerchantId();
  const templates = await getRecurringTemplates(merchantId);
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Recurring Entries</h1>
          <p className="text-sm text-muted-foreground">
            Automatically posted on schedule — no manual entry needed.
          </p>
        </div>
        <AddRecurringButton />
      </div>
      <RecurringTemplatesTable data={templates} />
    </div>
  );
}
```

The **Add Recurring** form uses a Shadcn Sheet with:
- Name and description fields
- Cron schedule selector (visual picker with presets: Monthly, Weekly, Quarterly, Custom)
- Dynamic journal lines (same reusable component as the manual journal entry form)
- Live balance validation before saving

---

## Phase 3 — AI Receipt Categorisation (Gemini SDK)

Merchants frequently have cash expenses not captured by any existing PO or order — petrol, ad hoc tools, meals, stationery. This automation lets them snap a photo of the receipt, upload it to the dashboard, and have the AI suggest the correct journal entry instantly. [web:100][web:106]

### 3.1 Receipt Upload Flow

```
Merchant uploads receipt image in dashboard
    ↓
File uploaded to Supabase Storage: receipts/{merchant_id}/{uuid}.jpg
    ↓
Supabase Storage trigger fires Edge Function: accounting-categorise-receipt
    ↓
Edge Function downloads image → sends to Gemini Vision
    ↓
Gemini extracts: vendor, amount, date, tax amount, category
    ↓
AI maps category to Chart of Accounts → suggests journal lines
    ↓
Inserts row into receipt_queue table with status 'pending_review'
    ↓
Dashboard shows merchant the suggested entry → one-click confirm or edit
```

### 3.2 Receipt Queue Table

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_receipt_queue.sql

CREATE TYPE receipt_status AS ENUM ('processing', 'pending_review', 'confirmed', 'rejected');

CREATE TABLE receipt_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,           -- path in Supabase Storage
  raw_ocr_text    TEXT,                    -- extracted text from Gemini
  vendor_name     TEXT,
  receipt_date    DATE,
  total_amount    NUMERIC(14, 2),
  tax_amount      NUMERIC(14, 2) DEFAULT 0,
  currency        TEXT DEFAULT 'MYR',
  status          receipt_status NOT NULL DEFAULT 'processing',
  suggested_lines JSONB,                   -- AI-suggested journal lines
  confidence      NUMERIC(4, 3),           -- 0.000–1.000
  journal_entry_id UUID REFERENCES journal_entries(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX receipt_merchant_idx ON receipt_queue(merchant_id, status);
```

### 3.3 Edge Function — AI Receipt Categoriser

`supabase/functions/accounting-categorise-receipt/index.ts`:

```typescript
import { serve }        from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.21.0';

serve(async (req) => {
  const { record } = await req.json(); // Storage trigger payload
  const storagePath: string = record.name;
  const merchantId: string  = storagePath.split('/')[1]; // receipts/{merchantId}/...

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Insert processing row immediately
  const { data: queueRow } = await supabase
    .from('receipt_queue')
    .insert({ merchant_id: merchantId, storage_path: storagePath, status: 'processing' })
    .select()
    .single();

  // Download image from Supabase Storage
  const { data: fileData } = await supabase.storage
    .from('receipts')
    .download(storagePath);

  const imageBytes  = await fileData!.arrayBuffer();
  const imageBase64 = btoa(String.fromCharCode(...new Uint8Array(imageBytes)));
  const mimeType    = storagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  // Fetch merchant's chart of accounts for context
  const { data: accts } = await supabase
    .from('accounts')
    .select('code, name, type')
    .eq('merchant_id', merchantId)
    .eq('is_active', true)
    .order('code');

  const coaContext = accts!
    .map((a) => `${a.code} — ${a.name} (${a.type})`)
    .join('
');

  // Call Gemini Vision
  const genai  = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!);
  const model  = genai.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `
You are an accounting assistant for a Malaysian SME.
Analyse this receipt image and return a JSON object with:
{
  "vendor_name": string,
  "receipt_date": "YYYY-MM-DD",
  "total_amount": number,
  "tax_amount": number (SST if shown, else 0),
  "currency": "MYR",
  "ocr_text": string (full extracted text),
  "suggested_lines": [
    { "account_code": string, "description": string, "debit": number, "credit": number }
  ],
  "confidence": number (0-1)
}

Rules:
- suggested_lines must balance (sum of debits = sum of credits)
- Use account code 1010 (Bank Account) as the credit (cash paid out)
- Map the expense category to the most appropriate expense account from the chart below
- Apply Malaysia SST rules: if SST is shown, debit account 1300 (SST Receivable) separately
- Return only valid JSON with no markdown fences

Chart of Accounts:
${coaContext}
  `;

  const result = await model.generateContent([
    { inlineData: { data: imageBase64, mimeType } },
    prompt,
  ]);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(result.response.text());
  } catch {
    await supabase.from('receipt_queue')
      .update({ status: 'pending_review' })
      .eq('id', queueRow.id);
    return new Response('parse error', { status: 200 });
  }

  // Update the queue row with AI results
  await supabase.from('receipt_queue').update({
    status:          'pending_review',
    raw_ocr_text:    parsed.ocr_text,
    vendor_name:     parsed.vendor_name,
    receipt_date:    parsed.receipt_date,
    total_amount:    parsed.total_amount,
    tax_amount:      parsed.tax_amount,
    currency:        parsed.currency ?? 'MYR',
    suggested_lines: parsed.suggested_lines,
    confidence:      parsed.confidence,
  }).eq('id', queueRow.id);

  return new Response('ok', { status: 200 });
});
```

### 3.4 Receipt Review Queue (Dashboard UI)

Add a **Receipt Queue** page at `apps/dashboard/app/(dashboard)/accounting/receipts/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { confirmReceiptEntry, rejectReceiptEntry } from '@/app/actions/accounting';
import { CheckCircle, XCircle, Edit } from 'lucide-react';

interface ReceiptQueueItem {
  id:             string;
  vendorName:     string | null;
  receiptDate:    string | null;
  totalAmount:    number | null;
  confidence:     number | null;
  storagePath:    string;
  suggestedLines: Array<{
    account_code: string; description: string; debit: number; credit: number;
  }> | null;
  status: 'pending_review' | 'confirmed' | 'rejected' | 'processing';
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (!score) return null;
  const pct     = Math.round(score * 100);
  const variant = pct >= 85 ? 'success' : pct >= 60 ? 'warning' : 'destructive';
  return <Badge variant={variant as any}>{pct}% confident</Badge>;
}

export function ReceiptQueueTable({ items }: { items: ReceiptQueueItem[] }) {
  const pending = items.filter((i) => i.status === 'pending_review');

  return (
    <div className="space-y-3">
      {pending.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          All receipts reviewed ✓
        </p>
      )}
      {pending.map((item) => (
        <div key={item.id} className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium">{item.vendorName ?? 'Unknown Vendor'}</p>
              <p className="text-sm text-muted-foreground">
                {item.receiptDate ?? '—'}  ·  RM {Number(item.totalAmount).toFixed(2)}
              </p>
            </div>
            <ConfidenceBadge score={item.confidence} />
          </div>

          {/* Suggested journal lines preview */}
          {item.suggestedLines && (
            <div className="rounded-md bg-muted/40 p-3 text-xs">
              <table className="w-full">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left pb-1">Account</th>
                    <th className="text-right pb-1">DR</th>
                    <th className="text-right pb-1">CR</th>
                  </tr>
                </thead>
                <tbody>
                  {item.suggestedLines.map((line, i) => (
                    <tr key={i}>
                      <td>{line.account_code} — {line.description}</td>
                      <td className="text-right tabular-nums">
                        {line.debit > 0 ? `RM ${line.debit.toFixed(2)}` : '—'}
                      </td>
                      <td className="text-right tabular-nums">
                        {line.credit > 0 ? `RM ${line.credit.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => confirmReceiptEntry(item.id)}
            >
              <CheckCircle className="mr-1 h-4 w-4" /> Confirm & Post
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {/* open edit sheet */}}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => rejectReceiptEntry(item.id)}
            >
              <XCircle className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 3.5 Server Actions for Receipt Queue

```typescript
// apps/dashboard/app/actions/accounting.ts (additions)

export async function confirmReceiptEntry(receiptId: string) {
  const merchantId = await getMerchantId();

  // Fetch the queued receipt with its suggested lines
  const { data: receipt } = await supabase
    .from('receipt_queue')
    .select('*')
    .eq('id', receiptId)
    .single();

  // Create the journal entry from the AI suggestion
  const entryNumber = await generateJournalNumber();

  await db.transaction(async (tx) => {
    const [je] = await tx.insert(journalEntries).values({
      merchant_id:  merchantId,
      entry_number: entryNumber,
      status:       'posted',
      source:       'manual',
      source_id:    receiptId,
      description:  `Receipt — ${receipt.vendor_name ?? 'Expense'}`,
      entry_date:   receipt.receipt_date
        ? new Date(receipt.receipt_date)
        : new Date(),
    }).returning({ id: journalEntries.id });

    const lines = receipt.suggested_lines as Array<{
      account_code: string; description: string; debit: number; credit: number;
    }>;

    // Resolve account codes to IDs
    const codes = lines.map((l) => l.account_code);
    const accts = await tx.select().from(accounts)
      .where(and(eq(accounts.merchant_id, merchantId), inArray(accounts.code, codes)));
    const byCode = Object.fromEntries(accts.map((a) => [a.code, a.id]));

    await tx.insert(journalEntryLines).values(
      lines.map((l, i) => ({
        journal_entry_id: je.id,
        account_id:       byCode[l.account_code],
        description:      l.description,
        debit:            String(l.debit),
        credit:           String(l.credit),
        line_order:       i,
      }))
    );

    // Mark receipt as confirmed
    await supabase.from('receipt_queue').update({
      status:           'confirmed',
      journal_entry_id: je.id,
      reviewed_at:      new Date().toISOString(),
    }).eq('id', receiptId);
  });

  revalidatePath('/accounting/receipts');
  revalidatePath('/accounting');
}

export async function rejectReceiptEntry(receiptId: string) {
  await supabase.from('receipt_queue')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', receiptId);

  revalidatePath('/accounting/receipts');
}
```

---

## Phase 4 — Automated Reports & SST Alerts

### 4.1 Monthly P&L Email Report

Merchants receive an automatically generated P&L summary on the 1st of every month via Resend, using your existing `packages/email` infrastructure.

#### New React Email Template

`packages/email/src/templates/monthly-accounting-report.tsx`:

```tsx
import {
  Html, Head, Body, Container, Heading, Hr, Text, Section, Row, Column,
} from '@react-email/components';

interface MonthlyReportEmailProps {
  merchantName:  string;
  periodLabel:   string;    // e.g. "March 2026"
  revenue:       number;
  expenses:      number;
  netProfit:     number;
  currency:      string;
  reportUrl:     string;
  topExpenses:   Array<{ name: string; amount: number }>;
}

export function MonthlyAccountingReportEmail({
  merchantName, periodLabel, revenue, expenses,
  netProfit, currency, reportUrl, topExpenses,
}: MonthlyReportEmailProps) {
  const isProfit = netProfit >= 0;

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f7f6f2' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '24px' }}>
          <Heading style={{ fontSize: '20px' }}>
            Monthly Report — {periodLabel}
          </Heading>
          <Text>Hi {merchantName}, here is your financial summary for {periodLabel}.</Text>
          <Hr />

          <Section style={{ background: '#fff', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
            <Row>
              <Column><Text style={{ color: '#6b7280', fontSize: '12px' }}>Revenue</Text>
                <Text style={{ fontSize: '20px', fontWeight: 'bold', color: '#01696f' }}>
                  {currency} {revenue.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </Text>
              </Column>
              <Column><Text style={{ color: '#6b7280', fontSize: '12px' }}>Expenses</Text>
                <Text style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444' }}>
                  {currency} {expenses.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </Text>
              </Column>
              <Column><Text style={{ color: '#6b7280', fontSize: '12px' }}>Net Profit</Text>
                <Text style={{ fontSize: '20px', fontWeight: 'bold', color: isProfit ? '#01696f' : '#ef4444' }}>
                  {isProfit ? '+' : ''}{currency} {netProfit.toLocaleString('en-MY', { minimumFractionDigits: 2 })}
                </Text>
              </Column>
            </Row>
          </Section>

          {topExpenses.length > 0 && (
            <>
              <Text style={{ fontWeight: 'bold' }}>Top Expenses</Text>
              {topExpenses.map((e) => (
                <Row key={e.name}>
                  <Column><Text style={{ fontSize: '13px' }}>{e.name}</Text></Column>
                  <Column align="right">
                    <Text style={{ fontSize: '13px' }}>{currency} {e.amount.toFixed(2)}</Text>
                  </Column>
                </Row>
              ))}
              <Hr />
            </>
          )}

          <a href={reportUrl}
            style={{ display: 'block', textAlign: 'center', background: '#01696f',
              color: '#fff', padding: '12px 24px', borderRadius: '6px', textDecoration: 'none' }}>
            View Full Report →
          </a>
        </Container>
      </Body>
    </Html>
  );
}
```

#### Edge Function — Monthly Report Mailer

`supabase/functions/email-monthly-report/index.ts`:

```typescript
import { serve }        from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { render }       from 'https://esm.sh/@react-email/render@0.0.12';

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get all active merchants with email
  const { data: merchants } = await supabase
    .from('merchants')
    .select('id, name, email')
    .eq('is_active', true);

  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const periodLabel = lastMonth.toLocaleString('en-MY', { month: 'long', year: 'numeric' });
  const from        = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1).toISOString();
  const to          = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0).toISOString();

  await Promise.allSettled(
    (merchants ?? []).map(async (merchant) => {
      // Query P&L for the previous month
      const { data: ledger } = await supabase.rpc('get_ledger_summary', {
        p_merchant_id: merchant.id,
        p_from:        from,
        p_to:          to,
      });

      const revenue  = (ledger ?? []).filter((r) => r.account_type === 'revenue')
        .reduce((s, r) => s + (r.credit_total - r.debit_total), 0);
      const expenses = (ledger ?? []).filter((r) => r.account_type === 'expense')
        .reduce((s, r) => s + (r.debit_total - r.credit_total), 0);
      const netProfit = revenue - expenses;

      const topExpenses = (ledger ?? [])
        .filter((r) => r.account_type === 'expense')
        .sort((a, b) => (b.debit_total - b.credit_total) - (a.debit_total - a.credit_total))
        .slice(0, 5)
        .map((r) => ({ name: r.account_name, amount: r.debit_total - r.credit_total }));

      // Send via Resend
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        },
        body: JSON.stringify({
          from:    'Hyperlocal Accounting <accounting@mail.yourdomain.com>',
          to:      merchant.email,
          subject: `Your ${periodLabel} Financial Summary`,
          html:    render(MonthlyAccountingReportEmail({
            merchantName: merchant.name,
            periodLabel,
            revenue,
            expenses,
            netProfit,
            currency:   'MYR',
            reportUrl:  `https://dashboard.yourdomain.com/accounting/reports/profit-loss`,
            topExpenses,
          })),
        }),
      });
    })
  );

  return new Response('ok', { status: 200 });
});
```

#### `pg_cron` Schedule — 1st of every month at 8 AM MYT

```sql
SELECT cron.schedule(
  'monthly-accounting-report',
  '0 0 1 * *',   -- 00:00 UTC = 08:00 MYT
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/email-monthly-report',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);
```

### 4.2 SST Filing Reminder

Malaysia SST is filed **bi-monthly** — every two months — with the deadline on the last day of the month following the taxable period. [web:93]

#### Edge Function — SST Reminder Mailer

`supabase/functions/email-sst-reminder/index.ts`:

```typescript
import { serve }        from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: merchants } = await supabase
    .from('merchants')
    .select('id, name, email')
    .eq('sst_registered', true);   // only SST-registered merchants

  // Determine the previous 2-month period
  const now          = new Date();
  const periodEnd    = new Date(now.getFullYear(), now.getMonth() - 1, 0); // last day of prev month
  const periodStart  = new Date(periodEnd.getFullYear(), periodEnd.getMonth() - 1, 1);
  const periodLabel  = `${periodStart.toLocaleString('en-MY', { month: 'long' })}–${periodEnd.toLocaleString('en-MY', { month: 'long', year: 'numeric' })}`;
  const filingDeadline = new Date(now.getFullYear(), now.getMonth(), 0)
    .toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' });

  await Promise.allSettled(
    (merchants ?? []).map(async (merchant) => {
      // Calculate SST figures for the filing period
      const { data: sstData } = await supabase.rpc('get_sst_summary', {
        p_merchant_id: merchant.id,
        p_from:        periodStart.toISOString(),
        p_to:          periodEnd.toISOString(),
      });

      const outputTax = sstData?.output_tax ?? 0;
      const inputTax  = sstData?.input_tax  ?? 0;
      const netSST    = outputTax - inputTax;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
        },
        body: JSON.stringify({
          from:    'Hyperlocal Accounting <accounting@mail.yourdomain.com>',
          to:      merchant.email,
          subject: `SST Filing Reminder — ${periodLabel} (Due ${filingDeadline})`,
          html: `
            <h2>SST Filing Reminder</h2>
            <p>Your SST return for <strong>${periodLabel}</strong> is due by <strong>${filingDeadline}</strong>.</p>
            <table style="width:100%;border-collapse:collapse">
              <tr><td>Output Tax (collected)</td><td align="right">RM ${outputTax.toFixed(2)}</td></tr>
              <tr><td>Input Tax (paid)</td><td align="right">RM ${inputTax.toFixed(2)}</td></tr>
              <tr style="font-weight:bold;border-top:1px solid #ccc">
                <td>Net SST Payable</td><td align="right">RM ${netSST.toFixed(2)}</td>
              </tr>
            </table>
            <p><a href="https://mysst.customs.gov.my">File on MyST Portal →</a></p>
            <p><a href="https://dashboard.yourdomain.com/accounting/reports/tax">View Full Tax Report →</a></p>
          `,
        }),
      });
    })
  );

  return new Response('ok', { status: 200 });
});
```

#### `pg_cron` Schedule — 20th of every even month (10 days before deadline)

```sql
SELECT cron.schedule(
  'sst-filing-reminder',
  '0 0 20 2,4,6,8,10,12 *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/email-sst-reminder',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);
```

---

## Phase 5 — Supabase Helper RPCs

Add two PostgreSQL functions called by the Edge Functions above for clean aggregation queries:

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_accounting_rpcs.sql

-- P&L/Balance sheet ledger summary
CREATE OR REPLACE FUNCTION get_ledger_summary(
  p_merchant_id UUID,
  p_from        TIMESTAMPTZ,
  p_to          TIMESTAMPTZ
)
RETURNS TABLE (
  account_id    UUID,
  account_code  TEXT,
  account_name  TEXT,
  account_type  TEXT,
  debit_total   FLOAT,
  credit_total  FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT
    a.id,
    a.code,
    a.name,
    a.type::TEXT,
    COALESCE(SUM(jel.debit),  0)::FLOAT,
    COALESCE(SUM(jel.credit), 0)::FLOAT
  FROM accounts a
  LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
  LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
    AND je.status = 'posted'
    AND je.entry_date BETWEEN p_from AND p_to
  WHERE a.merchant_id = p_merchant_id
    AND a.is_active   = true
  GROUP BY a.id, a.code, a.name, a.type
  ORDER BY a.code;
$$;

-- SST summary: output vs input tax
CREATE OR REPLACE FUNCTION get_sst_summary(
  p_merchant_id UUID,
  p_from        TIMESTAMPTZ,
  p_to          TIMESTAMPTZ
)
RETURNS TABLE (output_tax FLOAT, input_tax FLOAT) LANGUAGE sql STABLE AS $$
  SELECT
    -- Output tax: credit balance of SST Payable account (2100)
    COALESCE(SUM(CASE WHEN a.code = '2100' THEN jel.credit - jel.debit ELSE 0 END), 0)::FLOAT AS output_tax,
    -- Input tax: debit balance of SST Receivable account (1300)
    COALESCE(SUM(CASE WHEN a.code = '1300' THEN jel.debit - jel.credit ELSE 0 END), 0)::FLOAT AS input_tax
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  JOIN accounts a         ON a.id  = jel.account_id
  WHERE je.merchant_id = p_merchant_id
    AND je.status      = 'posted'
    AND je.entry_date  BETWEEN p_from AND p_to;
$$;
```

---

## Full File Structure

```
apps/dashboard/
├── app/(dashboard)/accounting/
│   ├── page.tsx                           # Overview
│   ├── recurring/
│   │   ├── page.tsx                       # Recurring templates list
│   │   └── _components/
│   │       ├── recurring-templates-table.tsx
│   │       └── add-recurring-sheet.tsx    # Shadcn Sheet + cron picker
│   └── receipts/
│       ├── page.tsx                       # Receipt review queue
│       └── _components/
│           ├── receipt-queue-table.tsx
│           └── receipt-upload-zone.tsx    # Supabase Storage uploader
├── app/actions/
│   └── accounting.ts                      # confirmReceiptEntry, rejectReceiptEntry
└── lib/accounting/
    └── queries.ts                         # getRecurringTemplates, getReceiptQueue

packages/email/src/templates/
└── monthly-accounting-report.tsx          # New email template

supabase/
├── functions/
│   ├── _shared/
│   │   └── journal-writer.ts              # Reusable JE creation utility
│   ├── accounting-post-sale/index.ts
│   ├── accounting-post-purchase/index.ts
│   ├── accounting-post-payment/index.ts
│   ├── accounting-post-refund/index.ts
│   ├── accounting-post-recurring/index.ts
│   ├── accounting-categorise-receipt/index.ts
│   ├── email-monthly-report/index.ts
│   └── email-sst-reminder/index.ts
└── migrations/
    ├── YYYYMMDDHHMMSS_recurring_journals.sql
    ├── YYYYMMDDHHMMSS_receipt_queue.sql
    └── YYYYMMDDHHMMSS_accounting_rpcs.sql
```

---

## What Still Requires Human Input

Even with full automation, three situations require merchant action:

- **Receipt review queue** — AI suggestions with confidence below 80% are flagged and must be manually confirmed or edited before posting
- **Recurring template setup** — One-time configuration per recurring expense (the automation runs itself after that)
- **Fiscal year closing** — Must be confirmed explicitly by the merchant to prevent accidental period lock

---

## Implementation Checklist

- [ ] Create `supabase/functions/_shared/journal-writer.ts` utility
- [ ] Deploy `accounting-post-sale` and wire DB webhook on `orders UPDATE`
- [ ] Deploy `accounting-post-purchase` and wire DB webhook on `purchase_orders UPDATE`
- [ ] Deploy `accounting-post-payment` and wire DB webhook on `payments INSERT`
- [ ] Deploy `accounting-post-refund` and wire DB webhook on `refunds INSERT`
- [ ] Apply `recurring_journal_templates` migration
- [ ] Deploy `accounting-post-recurring` Edge Function
- [ ] Register `process-recurring-journals` cron job via `pg_cron`
- [ ] Build Recurring Templates page in dashboard (list, add/edit sheet with cron picker)
- [ ] Apply `receipt_queue` migration
- [ ] Deploy `accounting-categorise-receipt` Edge Function
- [ ] Add `GEMINI_API_KEY` to Supabase secrets: `supabase secrets set GEMINI_API_KEY=...`
- [ ] Configure Supabase Storage trigger on `receipts` bucket to fire `accounting-categorise-receipt`
- [ ] Build Receipt Queue page (upload zone + review cards with confirm/edit/reject)
- [ ] Add `confirmReceiptEntry` and `rejectReceiptEntry` server actions
- [ ] Add `monthly-accounting-report.tsx` to `packages/email`
- [ ] Deploy `email-monthly-report` Edge Function
- [ ] Register `monthly-accounting-report` cron job via `pg_cron`
- [ ] Deploy `email-sst-reminder` Edge Function
- [ ] Register `sst-filing-reminder` cron job via `pg_cron`
- [ ] Apply `accounting_rpcs.sql` migration (get_ledger_summary, get_sst_summary)
- [ ] Add `sst_registered` boolean to merchants table for SST reminder filtering
- [ ] Add RLS policies on `recurring_journal_templates` and `receipt_queue` scoped to `merchant_id`
- [ ] Add `Recurring` and `Receipts` sub-items to Accounting sidebar nav
