-- 1. Create addresses table if not exists (safety)
CREATE TABLE IF NOT EXISTS public.addresses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  label           text not null default 'Home',
  recipient_name  text not null,
  phone           text not null,
  address_line1   text not null,
  address_line2   text,
  city            text not null,
  state           text not null,
  postcode        text not null,
  country         text not null default 'MY',
  is_default      boolean default false,
  lat             numeric(10, 7),
  lng             numeric(10, 7),
  location        geography(point, 4326),
  created_at      timestamptz default now()
);

-- 2. Enable RLS
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Allow users to view their own addresses
DROP POLICY IF EXISTS "Users can view their own addresses" ON public.addresses;
CREATE POLICY "Users can view their own addresses"
ON public.addresses FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to insert their own addresses
DROP POLICY IF EXISTS "Users can insert their own addresses" ON public.addresses;
CREATE POLICY "Users can insert their own addresses"
ON public.addresses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own addresses
DROP POLICY IF EXISTS "Users can update their own addresses" ON public.addresses;
CREATE POLICY "Users can update their own addresses"
ON public.addresses FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own addresses
DROP POLICY IF EXISTS "Users can delete their own addresses" ON public.addresses;
CREATE POLICY "Users can delete their own addresses"
ON public.addresses FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses(user_id);
