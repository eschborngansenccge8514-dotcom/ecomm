-- Migration to add POS PIN to user profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pos_pin text;

-- Add a comment for documentation
COMMENT ON COLUMN public.profiles.pos_pin IS '4-digit numeric PIN for POS terminal access and manager overrides.';
