-- Phase 7: Optimize journal entries for reconciliation
ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS amount NUMERIC(15,2) DEFAULT 0;

-- Trigger function to update journal entry amount based on lines
CREATE OR REPLACE FUNCTION public.sync_journal_entry_amount()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.journal_entries
    SET amount = (
        SELECT COALESCE(SUM(debit), 0)
        FROM public.journal_lines
        WHERE journal_entry_id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id)
    )
    WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger on journal_lines
CREATE TRIGGER trig_sync_journal_amount
AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.sync_journal_entry_amount();

-- Update existing entries
UPDATE public.journal_entries je
SET amount = (
    SELECT COALESCE(SUM(debit), 0)
    FROM public.journal_lines jl
    WHERE jl.journal_entry_id = je.id
);

-- Index for reconciliation speed
CREATE INDEX IF NOT EXISTS idx_je_amount_date ON public.journal_entries(amount, date);
