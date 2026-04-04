<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Write me the plan. Not build it

Here is the full implementation plan.

***

# E-Invoice Dashboard — Implementation Plan

**Core design philosophy:** Every merchant using this dashboard is a business owner, not a tax accountant. The interface must translate LHDN compliance into plain language, show them exactly what to do next, and make them feel in control — not overwhelmed.[^1][^2]

***

## Understanding the Problem Space

Before designing anything, anchor the UX around three real user mental states:


| User State | What They're Thinking | What the Dashboard Must Do |
| :-- | :-- | :-- |
| **First-time** | "What even is e-invoice?" | Onboard, explain, hold their hand step by step |
| **Active** | "Did my invoices go through?" | Show status at a glance, flag errors immediately |
| **Deadline pressure** | "Am I compliant this month?" | Surface compliance score, pending actions, deadlines |

The majority of MerchantMind users fall under **Phase 4 (RM1M–RM5M, from Jan 2026)** or **Phase 5 (RM500K–RM1M, from Jul 2026)**  — small business owners who have never touched LHDN APIs. The dashboard must abstract all technical complexity away completely.[^3]

***

## Route Structure

```
app/(dashboard)/einvoice/
├── page.tsx                     ← Main dashboard (overview + monitoring)
├── setup/
│   └── page.tsx                 ← Guided onboarding wizard (first-time only)
├── invoices/
│   ├── page.tsx                 ← Invoice list with status filters
│   └── [id]/page.tsx            ← Single invoice detail + LHDN status timeline
├── learn/
│   └── page.tsx                 ← Knowledge base / glossary
└── settings/
    └── page.tsx                 ← LHDN credentials, digital certificate, preferences
```


***

## Page 1 — Setup Wizard (`/einvoice/setup`)

This is the **first thing** a new user sees when they navigate to the e-invoice section. It only appears once, until setup is complete. It must not dump a form — it must tell a story.

### Step 1: "What is e-Invoice?" (Education gate)

A full-screen card before anything else. No forms yet. Just context.

**Content:**

- A simple 4-step visual flow illustrating how e-invoicing works: `You issue invoice → Submitted to LHDN → LHDN validates → Customer receives validated copy`[^4]
- One plain-language paragraph: *"Malaysia now requires businesses to submit invoices directly to LHDN (the tax authority) for approval before sending them to customers. MerchantMind does this automatically — you just need to connect your account once."*
- A "Which phase am I in?" interactive prompt — user enters their annual revenue, the system tells them exactly which phase applies and whether they're already mandatory or have time to prepare[^3]
- CTA: "Okay, let's get set up →"


### Step 2: Business Profile Verification

Fields:

- Business name (pre-filled from merchant profile)
- Tax Identification Number (TIN) — with inline link to LHDN TIN lookup
- Business Registration Number (SSM)
- MSIC code (with searchable dropdown + plain-language descriptions for each code)
- Business address (billing address)
- `msme_category`: Sole Proprietor / Sdn Bhd / Partnership

**Education inline:** Every field has a tooltip `?` icon. For TIN: *"Your TIN is assigned by LHDN. It looks like C12345678900 or IG12345678900. Find it on your tax return or at mytax.hasil.gov.my."*

### Step 3: LHDN MyInvois Connection

Two paths presented as cards, not a form:

**Option A — API Integration (Recommended)**

- User provides their Client ID + Client Secret from MyInvois portal
- Step-by-step screenshot guide embedded in the card showing exactly where to find these in the MyInvois portal
- "Test Connection" button — shows ✅ Connected or ❌ with specific error message

**Option B — Portal Upload (Manual fallback)**

- For users not ready for API: system generates a compliant XML/JSON file they manually upload to MyInvois portal
- Clear note: *"This means an extra step for each invoice. You can switch to automatic API later."*


### Step 4: Digital Certificate

- Explain what a certificate is in one sentence: *"This is a digital signature LHDN requires to confirm invoices came from your business — like a stamp of authenticity."*
- Two sub-options: Upload existing `.p12` certificate OR guide to request one from MyInvois
- Certificate expiry date displayed prominently after upload
- Warning shown 30 days before expiry


### Step 5: Default Invoice Settings

- Default currency (MYR pre-selected)
- Default SST rate (0%, 6%, 8%, or exempt)
- Default payment terms (e.g. 30 days)
- Whether they issue mostly B2B (individual invoices required) or B2C (consolidated daily/monthly invoice allowed)[^2]
- Toggle: "Auto-submit invoices to LHDN" — recommended ON

**Completion screen:** Animated checkmark, compliance phase badge, and a personalized summary: *"You're on Phase 4. Your deadline is January 2026. You're all set — MerchantMind will handle submissions automatically."*

***

## Page 2 — Main Dashboard (`/einvoice`)

This is the **command centre**. It must answer three questions at a glance: Am I compliant? What needs my attention? How are my numbers?

### Section A: Compliance Status Banner (always at top)

A full-width sticky banner — the first element on the page. Three possible states:

**🟢 Compliant** — *"You are compliant for April 2026. All invoices submitted. Next deadline: 15 May 2026."*

**🟡 Action Required** — *"3 invoices failed LHDN validation. Fix them before 15 May to stay compliant."* + "Review Now" button

**🔴 Overdue** — *"You have 7 unsubmitted invoices past their submission window. You may face penalties."* + urgent CTA

This banner should never be dismissible. It is the most important signal on the page.

### Section B: KPI Cards (5 cards, top row)

| Card | Metric | Supporting Context |
| :-- | :-- | :-- |
| **Submitted This Month** | Count + total RM value | vs last month delta |
| **Validated ✅** | Count (green) | "Cleared by LHDN" |
| **Pending ⏳** | Count (yellow) | "Awaiting LHDN response" |
| **Failed ❌** | Count (red) | "Needs your attention" |
| **Compliance Rate** | Percentage | "X of Y invoices compliant" |

Each card has a plain-language subtitle. "Validated" is never shown as just a number — it always says *"Cleared by LHDN"* so the user understands what validated means.[^4]

### Section C: What Needs Your Attention

A prioritised task list. Not a notification bell — a permanent, actionable section. Items are auto-generated by the system:

- `❌ Invoice #INV-0023 rejected — TIN mismatch. [Fix Now]`
- `⚠️ 72-hour cancellation window closing for #INV-0019. Expires in 4h. [Review]`
- `🔔 Certificate expires in 14 days. [Renew]`
- `📋 Consolidated B2C invoice for March not yet generated. [Generate Now]`
- `📅 Phase 5 mandatory deadline: 1 July 2026 — 88 days away. [Prepare]`

Each item has: an icon (not color alone), a short plain-language description, and a direct action button. Nothing sends the user hunting for where to fix it.

**Education inline:** A `?` icon beside "72-hour cancellation window" expands a tooltip: *"LHDN gives you 72 hours to cancel an invoice after submission. After that, you must issue a Credit Note instead."*[^2]

### Section D: Invoice Activity Chart

A 30-day area chart showing daily submission volume, colour-coded by status (validated / pending / failed). Hovering shows: date, count, and value in RM.

Below the chart, a mini-legend that educates: *"Validated = approved by LHDN and usable as a tax document. Failed = rejected — check error reasons in the invoice detail."*

### Section E: Recent Invoices Table

The latest 10 invoices with:


| Column | Notes |
| :-- | :-- |
| Invoice No. | Clickable → detail page |
| Buyer | Name |
| Amount (RM) | Tabular numbers |
| Submitted | Timestamp |
| LHDN Status | Badge — see status system below |
| LHDN UUID | Truncated, copy icon |
| Action | Contextual: "Retry" / "Cancel" / "View" |

**Status badge system** — never just a colour, always text + icon:

- `✅ Validated` — green
- `⏳ Pending` — yellow
- `❌ Invalid` — red
- `🚫 Cancelled` — grey
- `📋 Draft` — light grey (not yet submitted)
- `📦 Consolidated` — blue (B2C batch)

***

## Page 3 — Invoice List (`/einvoice/invoices`)

A full data table with:

### Filters Bar (persistent, above table)

- Date range picker
- Status multi-select (Validated / Pending / Failed / Cancelled)
- Invoice type: B2B / B2C / Self-billed / Credit Note / Debit Note
- Channel: Shopee / Lazada / TikTok Shop / POS / Manual
- Search by buyer name, invoice number, or LHDN UUID


### Table Behaviour

- Sortable columns
- Sticky header
- Bulk actions: "Resubmit Selected" / "Export to Excel" / "Generate Consolidated"
- Row hover shows quick-action buttons inline
- Empty state for Failed filter: *"No failed invoices — great! LHDN accepted everything."*


### Education moment — Invoice Type Explainer

A collapsed info strip just below the filters (expandable with a `?` button):

> *"B2B invoices are issued to businesses — LHDN requires individual submission for each. B2C invoices can be batched into one Consolidated e-Invoice per day (or month). [Learn more →]"*

This is always visible but not intrusive. It collapses once the user has visited this page 5+ times.

***

## Page 4 — Invoice Detail (`/einvoice/invoices/[id]`)

The most educational page in the system. For a user who doesn't know why their invoice failed, this is where they learn.

### Layout: Left column (invoice data) + Right column (LHDN status timeline)

**Left column — Invoice contents:**

- All 55 LHDN fields rendered in human-readable sections, not raw XML[^2]
- Sections: Seller Info / Buyer Info / Line Items / Tax Summary / Totals
- Fields with validation errors highlighted in red with plain-language error message

**Right column — LHDN Status Timeline:**

```
● Draft created                       2 Apr, 2:34 PM
● Submitted to LHDN                   2 Apr, 2:34 PM
● LHDN Validation: Processing         2 Apr, 2:34 PM
❌ LHDN Validation: Rejected          2 Apr, 2:35 PM
   Error: "Buyer TIN not found in IRBM database"
   [What does this mean?]  [How to fix it]
```

**"What does this mean?" expander** (critical UX feature):

For every LHDN error code, the system shows a plain-language explanation and fix guide. Example:

> *"LHDN couldn't find your buyer's TIN number in their database. This usually means: (1) the TIN was typed incorrectly, or (2) the buyer hasn't registered with LHDN yet. If it's a small B2C purchase under RM200, you can use the general public TIN (EI00000000010) instead."*

This transforms a cryptic API error into an actionable fix — this is the most important piece of education in the entire product.

**Actions bar (context-aware):**

- If `pending`: "Cancel Invoice" (with 72h countdown)
- If `rejected`: "Edit \& Resubmit" (opens a pre-filled correction form)
- If `validated`: "Download PDF" / "Send to Buyer" / "Issue Credit Note"
- Always: "View Raw XML" (collapsed by default, for power users)

***

## Page 5 — Learn (`/einvoice/learn`)

A lightweight knowledge base. Not a full docs site — just the 8–10 concepts a merchant actually needs.

### Structure: Topic Cards

Each card is one concept, 3–4 sentences max, with a visual icon:

1. **What is e-Invoice?** — The 30-second explanation
2. **Which phase am I in?** — Revenue-based calculator, interactive
3. **B2B vs B2C vs Consolidated** — When do I need individual vs batch invoices?
4. **The 72-hour cancellation rule** — What can and can't be changed after submission
5. **Credit Notes \& Debit Notes** — How to correct an already-validated invoice
6. **LHDN UUID** — What it is, why it matters (it's your proof of compliance)
7. **SST in e-Invoice** — Which rate applies to which goods
8. **Digital Certificate** — What it is and when to renew
9. **Common Error Codes** — The top 10 LHDN rejection reasons, plain-language explained
10. **Penalties for non-compliance** — What happens if you miss your phase deadline

Each card links to the relevant part of the dashboard where the user can take action.

***

## Page 6 — Settings (`/einvoice/settings`)

Clean, tabbed settings page:

**Tab 1: LHDN Connection**

- Display current connection status (API or manual)
- Client ID / Client Secret (masked, with "Reveal" toggle)
- Re-test connection button
- Certificate management: upload / expiry date / renewal link

**Tab 2: Business Profile**

- TIN, SSM number, MSIC code
- All editable with inline save

**Tab 3: Invoice Defaults**

- Default SST rate
- Default payment terms
- Auto-submit toggle (with explanation: *"When ON, invoices are automatically sent to LHDN when an order is marked complete. When OFF, you manually trigger submission from the invoice detail page."*)
- Consolidated invoice settings: frequency (daily / monthly), who it covers (all B2C / specific channels)

**Tab 4: Notifications**

- Email alerts: On rejection / On validation failure / 72h window warning / Certificate expiry
- Each toggle has a plain-language description of what the email will say

***

## Component Library: Education-First Patterns

These are reusable UI primitives used across every page to maintain a consistent educational tone.

### 1. `<InlineExplainer />` — the `?` tooltip

Used on every technical term. Has two modes: tooltip (short) and expandable panel (full explanation). Never opens a new tab — context stays intact.

### 2. `<StatusBadge />` — always text + icon + colour

Never colour alone. Every status readable without colour perception.

### 3. `<ActionRequired />` — the orange nudge card

A compact card pattern: icon + plain sentence + single action button. Used in the attention section and inline in tables. Never says "Error" — always says what to do next.

### 4. `<CompliancePhaseCard />` — the phase awareness widget

Shows the user's phase, start date, and a simple progress bar toward their enforcement deadline. Shown in the setup wizard and on the main dashboard's first visit.

### 5. `<LhdnTimeline />` — the status story

The right-column component in invoice detail. Every submission has a visual story — not just a status badge.

### 6. `<ErrorGuide />` — error → plain English → fix

The most impactful component. Maps every known LHDN error code to: what it means, common cause, step-by-step fix.

### 7. `<FirstVisitOverlay />` — the progressive disclosure layer

On first visit to any section, a subtle banner appears at the top: *"First time here? Here's what this page does in 10 seconds → [Quick tour]"*. Dismissed permanently after viewing.

***

## Data Model (Supabase)

```
einvoice_documents
  id, merchant_id, order_id (nullable), source_channel
  document_type: 'invoice' | 'credit_note' | 'debit_note' | 'consolidated'
  invoice_number, lhdn_uuid, lhdn_submission_uid
  status: 'draft' | 'submitted' | 'validated' | 'rejected' | 'cancelled'
  buyer_name, buyer_tin, buyer_registration_no
  subtotal_rm, tax_rm, total_rm, currency
  submitted_at, validated_at, cancelled_at
  lhdn_response_raw (JSONB)   ← raw API response preserved for debugging
  error_code, error_message   ← extracted and stored separately for UI
  is_b2c_consolidated (bool)
  consolidated_period_start, consolidated_period_end
  created_at, updated_at

einvoice_line_items
  id, document_id, description, quantity, unit_price
  classification_code, tax_type, tax_rate, line_total_rm

einvoice_settings (one row per merchant)
  merchant_id, tin, ssm_number, msic_code
  connection_type: 'api' | 'manual'
  client_id, client_secret_encrypted
  certificate_expiry_date
  auto_submit (bool)
  default_sst_rate, default_payment_terms
  b2c_consolidation_frequency: 'daily' | 'monthly'
  phase_category: 1 | 2 | 3 | 4 | 5
  onboarding_completed_at
```


***

## State Machine: Invoice Lifecycle

Every invoice follows a strict state machine — the UI renders a different experience at each state:[^5][^4]

```
DRAFT → SUBMITTED → VALIDATED ✅
                 ↘ REJECTED ❌ → (edit) → SUBMITTED (retry loop)
VALIDATED → CANCELLED 🚫  (only within 72 hours)
VALIDATED → CREDIT_NOTE_ISSUED  (after 72 hours, to correct errors)
```

The UI must always show the user exactly which state they are in and what action is available. No dead ends.

***

## Notifications \& Alerts

| Trigger | Channel | Message |
| :-- | :-- | :-- |
| Invoice validated | In-app badge | *"Invoice \#INV-0044 cleared by LHDN ✅"* |
| Invoice rejected | Email + in-app red alert | *"INV-0045 was rejected. Reason: [plain English]. Fix it here →"* |
| 60h since submission (72h window closing) | Email + yellow banner | *"You have 12 hours to cancel INV-0043 if needed."* |
| Certificate expiry in 30 days | Email + settings badge | *"Your digital certificate expires 4 May. Renew now to avoid submission failures."* |
| Monthly compliance summary | Email (1st of month) | *"March summary: 47 invoices — 46 validated, 1 rejected (fixed). ✅ Fully compliant."* |
| Phase deadline approaching | Email (90 days, 30 days, 7 days) | *"Your e-invoice mandatory deadline is in 30 days. Setup checklist →"* |


***

## Progressive Disclosure Strategy

The single most important design decision for non-technical users is **what to hide**. The following information exists but is hidden behind progressive reveal:


| Hidden by default | Revealed when |
| :-- | :-- |
| Raw XML / JSON payload | User clicks "View raw" on invoice detail |
| All 55 LHDN fields | "Show full invoice data" toggle |
| API connection settings | User explicitly goes to Settings → LHDN |
| LHDN error code (e.g. `CF302`) | Shown below the plain English explanation |
| Submission UID vs UUID distinction | Tooltip on hover only |
| UBL 2.1 schema details | Learn page only, collapsed by default |

The default view shows: what happened, what it means, and what to do. Everything else is opt-in.
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://www.cleartax.com/my/en/different-phases-implementation-timelines-einvoicing-malaysia

[^2]: https://accountingfirmjohor.com/malaysia-e-invoice-mandatory-lhdn-e-invoice-requirement/

[^3]: https://webnacc.com/malaysia-e-invoicing-2025-2026/

[^4]: https://www.yycadvisors.com/guide-to-understanding-e-invoice-syetem-in-malaysia.html

[^5]: https://pages.marmin.ai/blogs/malaysia/streamlining-business-transactions-in-malaysia-a-guide-to-e-invoicing-via-api

[^6]: PROJECT_OVERVIEW.md

[^7]: https://www.hasil.gov.my/media/0xqitc2t/lhdnm-e-invoice-general-faqs.pdf

[^8]: https://www.hasil.gov.my/en/e-invoice/reference-for-the-implementation-of-e-invoice/guidelines/

[^9]: https://tradeshift.com/resources/compliance/malaysia-e-invoicing-clearance-mandate-2025/

[^10]: https://www.vatcalc.com/malaysia/malaysia-e-invoicing-2023/

[^11]: https://www.youtube.com/watch?v=nQZbjz-ZUCI

[^12]: https://www.banqup.com/resources/blog/malaysia-national-e-invoicing-initiative-and-mandatory-e-reporting-explained

[^13]: https://www.flick.network/en-my/e-invoicing-malaysia

[^14]: https://www.cleartax.com/my/en/e-invoicing-malaysia

[^15]: https://www.hasil.gov.my/media/fzagbaj2/irbm-e-invoice-guideline.pdf

[^16]: https://myeinvois.my/key-changes-in-the-e-invoice-in-malaysia-guidelines-2025/

