# Phase 2 Context: POS Session & Financial Integrity

## Domain Boundary
Hardening the POS session lifecycle from start to finish, including cash reconciliation, session-end reporting (Z-Report), and automated accounting integration via batched journal entries.

## Decisions

### 💰 Reconciliation & Cash Management
- **Discrepancy Policy:** Strict. Any difference between expected cash (system) and counted cash (actual) must be accompanied by a mandatory reason note.
- **Reporting:** Discrepancies should be logged clearly in the session summary for manager review.

### 📖 Financial Integration
- **Posting Strategy:** Session-end batching. Instead of real-time posting per transaction, all sales, taxes, and discounts from a session will be aggregated into a single set of Journal Entries when the session is finalized.
- **Categories:** The batch should maintain splits for revenue categories and tax types (SST) to ensure accurate P&L reporting.

### 📊 Closing Workflow (Z-Report)
- **Output:** A comprehensive Z-Report summary showing total sales (by category), payment method breakdown, total tax collected, and reconciliation results.
- **Hardware:** Support for physical printing of the Z-Report.
- **Configuration:** Printing should be optional and configurable via a toggle in the POS settings.

## Technical Notes
- **Supabase:** Leverage the existing `pos_sessions` table and ensure it tracks `opening_cash`, `closing_cash`, `reconciliation_notes`, and `total_sales`.
- **Accounting Engine:** Extend the auto-poster to handle a `POS_SESSION_BATCH` event.
- **UI:** Implement a multi-step "End Session" wizard:
  1. Count Cash (Actual).
  2. Review Discrepancy (Add note if needed).
  3. Finalize & Post to Accounting.
  4. Print Z-Report (Optional).
