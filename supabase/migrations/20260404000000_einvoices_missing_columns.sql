-- Add missing buyer and total columns to einvoices table
ALTER TABLE public.einvoices 
ADD COLUMN IF NOT EXISTS buyer_name TEXT,
ADD COLUMN IF NOT EXISTS buyer_tin TEXT,
ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0;
