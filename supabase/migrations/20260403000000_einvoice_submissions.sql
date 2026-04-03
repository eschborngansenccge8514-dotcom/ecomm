-- Add to packages/db/migrations/
create table einvoice_submissions (
  id               uuid primary key default gen_random_uuid(),
  merchant_id      uuid not null references auth.users(id),
  batch_id         text unique not null,    -- internal batch reference
  lhdn_uuid        text,                    -- returned by LHDN after submission
  order_ids        text[] not null,         -- array of included order IDs
  invoice_type     text not null,           -- 'individual' | 'consolidated' | 'batch'
  status           text not null default 'pending',
  -- 'pending' | 'submitted' | 'valid' | 'invalid' | 'cancelled'
  lhdn_response    jsonb,                   -- raw LHDN response for debugging
  error_codes      text[],                  -- LHDN error codes if invalid
  submitted_at     timestamptz,
  validated_at     timestamptz,
  created_at       timestamptz default now()
);

alter table einvoice_submissions enable row level security;
create policy "own submissions" on einvoice_submissions
  for all using (merchant_id = auth.uid());

create index on einvoice_submissions(merchant_id, status);
create index on einvoice_submissions(batch_id);
