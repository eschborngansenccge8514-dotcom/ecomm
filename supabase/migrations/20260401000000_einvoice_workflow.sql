-- Add enum for e-invoice status
DO $$ BEGIN
    CREATE TYPE public.einvoice_status AS ENUM ('pending_buyer_request', 'needs_einvoice_now', 'converted_to_individual', 'sent_to_consolidated_batch');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Alter orders table to include the new columns
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS einvoice_status public.einvoice_status DEFAULT 'pending_buyer_request',
ADD COLUMN IF NOT EXISTS einvoice_details JSONB DEFAULT '{}'::jsonb;

-- Update existing orders to have the default status
UPDATE public.orders SET einvoice_status = 'pending_buyer_request' WHERE einvoice_status IS NULL;
