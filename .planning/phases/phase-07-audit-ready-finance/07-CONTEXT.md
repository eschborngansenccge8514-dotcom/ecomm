# Phase Context - Phase 07: Audit-Ready Finance & Scale

Implementing immutable audit logs, AI-guided bank reconciliation, and production build optimizations.

## Domain Boundary
Financial integrity, data immutability, audit trails, and reconciliation workflows.

## Canonical Refs
- [ROADMAP.md](../../ROADMAP.md)
- [PROJECT.md](../../PROJECT.md)
- [20260409000015_audit_and_banking_schema.sql](../../../supabase/migrations/20260409000015_audit_and_banking_schema.sql)

## Decisions

<decisions>

### 1. Reconciliation Pattern: AI-Guided Matching
- **Decision**: Implement a CSV/Excel statement uploader with an AI-driven matching engine.
- **Implementation**: 
    - Use a custom prompt to compare Bank Statement lines (date, description, amount) against candidate Journal Entries.
    - Provide "Match Probabilities" (High/Medium/Low) in the UI.
- **Rationale**: Reduces manual human matching effort and minimizes reconciliation errors.

### 2. Audit Trail: Trigger-Based Immutability
- **Decision**: Use PostgreSQL triggers to capture all DML operations on core tables.
- **Scope**: `products`, `transactions`, `journal_entries`, `ledger`.
- **Enforcement**: RLS policies will strictly forbid `UPDATE` or `DELETE` on the `audit_logs` table for all users including Service Role (if possible via triggers).

### 3. Financial Controls: Period Locking
- **Decision**: Implement a system to lock financial periods.
- **Behavior**: Once a period (month) is locked, a reversing transaction must be used to correct errors instead of direct updates.
- **Workflow**: Manager-level approval requirement to lock/unlock a period.

### 4. Build Strategy: Production Hardening
- **Decision**: Prioritize build stability and query performance for financial reporting.
- **Implementation**:
    - Index optimization for `audit_logs` (Composite index on `table_name` and `created_at`).
    - Move reporting RPCs to materialized views or indexed queries where possible.

</decisions>

## Specifics

<specifics>
- **CSV Format**: Support generic CSV headers with a mapping UI for Price, Date, and Description columns.
- **Audit Diff UI**: Specialized component to render JSON diffs in a human-readable format.
</specifics>

## Deferred
- **Direct Bank API (Swift/Open Banking)**: Deferred to Milestone 4.
- **Foreign Currency Reconciliation**: Currently RM (Ringgit) only.
