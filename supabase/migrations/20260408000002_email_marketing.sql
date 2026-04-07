-- Add marketing configuration to merchants
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS marketing_domain TEXT,
ADD COLUMN IF NOT EXISTS marketing_from_name TEXT;

-- Create email campaigns table
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  segment TEXT NOT NULL DEFAULT 'all',
  status TEXT NOT NULL DEFAULT 'draft',
  total_recipients INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Add indexes for performance
  CONSTRAINT valid_status CHECK (status IN ('draft', 'sending', 'sent', 'failed'))
);

-- Enable RLS on email_campaigns
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for email_campaigns
CREATE POLICY "Merchants can view their own campaigns" 
  ON public.email_campaigns FOR SELECT 
  USING (merchant_id = (SELECT id FROM public.merchants WHERE id = email_campaigns.merchant_id));

CREATE POLICY "Merchants can insert their own campaigns" 
  ON public.email_campaigns FOR INSERT 
  WITH CHECK (merchant_id = (SELECT id FROM public.merchants WHERE id = email_campaigns.merchant_id));

CREATE POLICY "Merchants can update their own campaigns" 
  ON public.email_campaigns FOR UPDATE 
  USING (merchant_id = (SELECT id FROM public.merchants WHERE id = email_campaigns.merchant_id));

-- Add index on merchant_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_campaigns_merchant_id ON public.email_campaigns(merchant_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON public.email_campaigns(status);
