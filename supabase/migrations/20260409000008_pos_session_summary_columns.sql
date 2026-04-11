-- Migration: 20260409000008_pos_session_summary_columns.sql
-- Description: Add summary columns to pos_sessions for reporting and reconciliation

ALTER TABLE public.pos_sessions 
ADD COLUMN IF NOT EXISTS expected_cash_rm NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_sales_rm NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS discrepancy_rm NUMERIC DEFAULT 0;

-- Optional: Add index for performance on session transactions
CREATE INDEX IF NOT EXISTS idx_pos_transactions_session_id ON public.pos_transactions(session_id);
