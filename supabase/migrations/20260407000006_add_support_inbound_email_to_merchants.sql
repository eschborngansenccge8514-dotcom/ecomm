-- Add support_inbound_email to merchants to allow dedicated support agent email addresses
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS support_inbound_email text;

-- Add a comment for clarity
COMMENT ON COLUMN public.merchants.support_inbound_email IS 'Dedicated email address for the Support Agent (e.g., support@mail.merchant.com).';
