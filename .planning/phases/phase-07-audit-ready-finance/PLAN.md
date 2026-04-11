# Implementation Plan - Phase 7: Audit-Ready Finance & Scale

Phase 7 focuses on ensuring financial integrity through immutable audit logs and a robust bank reconciliation system, while also preparing the application for production scale.

## 1. Audit Trail System
The database schema and triggers for `audit_logs` are already implemented. We need the UI to expose this to merchants.

- [x] **Database Schema**: Already exists in migration `20260409000015_audit_and_banking_schema.sql`.
- [ ] **Create Audit Logs Page**: `apps/dashboard/src/app/(dashboard)/settings/audit/page.tsx`
- [ ] **Implement Audit Log Viewer**:
    - List of entries with filtering by Table, User, and Date.
    - Component to display "Diffs" between `old_data` and `new_data`.
- [ ] **Ensure Immutability**: Verify RLS prevents even merchants from updating or deleting audit logs (only read allowed).

## 2. Bank Reconciliation Refinement
The basic UI exists but uses mock data for matches. We need to implement the real matching engine and import logic.

- [ ] **Improve Matching Engine**: 
    - Create a server action `findPotentialMatches(bank_line_id)` that searches `journal_entries` and `invoices` for similar amounts and dates.
- [ ] **Implement Bank Statement Import**:
    - Add a CSV parser in the `ReconcileClient`.
    - Create server action `importBankStatement(bank_account_id, csv_data)` to seed `bank_statement_lines`.
- [ ] **Confirm Match Implementation**:
    - Action to update `bank_statement_lines.status` to 'matched' and link `matched_journal_entry_id`.
- [ ] **Manual Posting**:
    - Allow users to "Post to Account" which creates a new journal entry if no match is found.

## 3. Scale & Production Readiness
- [ ] **Database Optimization**:
    - Add indexes for common query patterns in `audit_logs` and `bank_statement_lines` (if not already done).
    - Review slow RPCs or queries using Supabase dashboard (or local logs).
- [ ] **Build Optimization**:
    - Run `npm run build` at root and in `apps/dashboard`.
    - Check for large dependencies or hydration issues that could slow down production.
- [ ] **Scaling Prep**:
    - Ensure multi-tenant isolation (RLS) is explicitly tested for the new audit and banking tables.

## 4. Verification (UAT)
- [ ] **UAT 1**: Perform an update on a Product and verify it appears in the Audit Trail.
- [ ] **UAT 2**: Import a CSV bank statement and successfully match one line to an existing Journal Entry.
- [ ] **UAT 3**: Manually post a bank line to a "General Expense" account and verify the Journal Entry creation.
