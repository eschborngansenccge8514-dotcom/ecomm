# Project1 (Merchant OS)

## What This Is

The ultimate business OS for Malaysian SMEs, designed to automate complex operations like accounting, inventory, and logistics through a beginner-friendly interface. It empowers small business owners to manage their entire ecosystem—from marketplaces like Shopee to local delivery via Lalamove—without needing technical or financial expertise.

## Core Value

Frictionless business automation for non-experts.

## Requirements

### Validated

<!-- Shipped and confirmed valuable through existing codebase. -->

- ✓ Multi-tenant Merchant Dashboard (Next.js 16)
- ✓ Standardized Accounting Engine (Ledger/Journal)
- ✓ E-commerce Sync (Shopee, Lazada, TikTok Shop)
- ✓ AI Receipt Extraction & Expense Management
- ✓ Malaysian Tax Compliance (SST-02)

### Active

<!-- Current scope building toward full rollout. -->

- [ ] Beginner-friendly UX/UI enhancements (onboarding, guides)
- [ ] Comprehensive POS session management & reconciliation
- [ ] Automated Purchase Order (PO) workflow via AI extraction
- [ ] Full Malaysian E-Invoicing (MyInvois) rollout
- [ ] Public-facing Marketing & Solution pages

### Out of Scope

<!-- Explicit boundaries. -->

- (None currently specified)

## Context

The project is a high-scale monorepo designed for the Malaysian business ecosystem. It handles sensitive financial data and requires high reliability in accounting postings. The user interface prioritizes "beginner friendliness" to reduce the learning curve for traditional SME owners.

## Constraints

- **Tech Stack**: Next.js 16 (Canary), React 19, Supabase, Tailwind 4.
- **Compliance**: Must strictly adhere to Malaysian LHDN and SST regulations.
- **Security**: Strict multi-tenancy isolation via Supabase RLS.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js 16/React 19 | Use cutting-edge React features (Server Actions, Suspense) for performance. | — Pending |
| Supabase RLS | Delegate multi-tenancy security to the database layer. | ✓ Good |
| AI-Centric UX | Use LLMs to automate manual data entry (expenses, POs). | ✓ Good |

---
*Last updated: 2026-04-09 after Project Initialization*
