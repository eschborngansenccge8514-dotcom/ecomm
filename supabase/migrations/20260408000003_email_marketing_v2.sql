-- Add V2 fields to email_campaigns
ALTER TABLE public.email_campaigns 
ADD COLUMN IF NOT EXISTS segment_criteria JSONB,
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS opens INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS clicks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bounces INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS complaints INTEGER DEFAULT 0;

-- Add marketing_opt_out to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS marketing_opt_out BOOLEAN DEFAULT false;

-- Add index for opt-out filtering
CREATE INDEX IF NOT EXISTS idx_profiles_marketing_opt_out ON public.profiles(marketing_opt_out);
