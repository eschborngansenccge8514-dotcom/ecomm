-- Migration: 20260409000010_pos_session_reconciliation.sql
-- Description: Add reconciliation and posting columns to pos_sessions

ALTER TABLE public.pos_sessions 
ADD COLUMN IF NOT EXISTS actual_cash_counted_rm NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT,
ADD COLUMN IF NOT EXISTS posted_to_journal BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

-- Ensure actual_cash_counted_rm is used consistently with expected_cash_rm
COMMENT ON COLUMN public.pos_sessions.actual_cash_counted_rm IS 'Physical cash counted by the cashier at the end of the session';
COMMENT ON COLUMN public.pos_sessions.reconciliation_notes IS 'Reason note provided by the cashier for any cash discrepancy';
COMMENT ON COLUMN public.pos_sessions.posted_to_journal IS 'Flag indicating if the session totals have been posted to the accounting ledger';
COMMENT ON COLUMN public.pos_sessions.closed_at IS 'Timestamp when the session was closed and reconciled';
