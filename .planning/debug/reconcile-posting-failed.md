# Debug Session: reconcile-posting-failed

## Symptoms
- **Expected**: Bank transaction reconciliation should succeed.
- **Actual**: Fails with toast error "Posting failed: {code: ..., message: ...}".
- **Error**: `{code: '23502', message: 'null value in column "entry_number" of relation "journal_entries" violates not-null constraint'}` (Inferred from schema and code).

## Investigation
- Checked `journal_entries` schema: `entry_number` is `NOT NULL`.
- Checked `postManualReconcile` in `apps/dashboard/src/app/(dashboard)/accounting/reconcile/actions.ts`.
- Found that the `insert` call into `journal_entries` was missing the `entry_number` field.
- Checked `accounting/actions.ts` for comparison and found that `entry_number` is generated there using a count of existing entries.

## Root Cause
The `entry_number` column in the `journal_entries` table has a `NOT NULL` constraint but no default value. The `postManualReconcile` server action was attempting to insert a new journal entry without providing this mandatory field, causing a database-level constraint violation.

## Resolution
- Modified `postManualReconcile` to:
    1. Fetch the total count of journal entries for the merchant to generate a sequence number.
    2. Generate a standard `entry_number` string (e.g., `JE-2026-0001`).
    3. Include `entry_number` in the `journal_entries` insert.
    4. Added `posted_by` and `posted_at` for better audit tracking.

## Status: Resolved
Fix applied to `apps/dashboard/src/app/(dashboard)/accounting/reconcile/actions.ts`.
