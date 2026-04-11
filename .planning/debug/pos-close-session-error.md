# Debug Session: POS Session Closure Error

## Symptoms
- **User Action**: Clicks "Close POS & Count Cash" in the POS dashboard.
- **Error**: `{code: ..., details: Null, hint: Null, message: ...}` (Supabase/PostgREST error format).
- **Location**: Likely `apps/dashboard/src/lib/pos-actions.ts` in `closePosSession` function.

## Hypotheses
1. **RLS Issue**: The `update` call fails because the user doesn't have permission to update the `pos_sessions` record, or the row isn't found due to RLS.
2. **Missing Column**: One of the columns in the `update` payload (e.g., `posted_to_journal`, `total_sales_rm`) doesn't exist in the database.
3. **Invalid Data**: One of the values being sent (like `NaN` or `Infinity`) is rejected by Postgres.
4. **Foreign Key / Constraint**: A constraint is failing (though unlikely for a simple update).

## Investigation Plan
1. Check if `postPOSSessionBatch` is failing (it's caught, so it shouldn't block, but might be related).
2. Validate each column in the `update` payload against the database schema.
3. Check for `NaN` or `Infinity` in the calculation of `discrepancy` and `summary` values.
4. Verify RLS policies for `pos_sessions` and related tables.
