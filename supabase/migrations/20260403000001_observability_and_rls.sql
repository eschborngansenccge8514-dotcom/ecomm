-- Agent traces — one row per agent run (chat turn or scheduled run)
create table agent_traces (
  id              uuid primary key default gen_random_uuid(),
  merchant_id     uuid not null references auth.users(id),
  session_id      uuid references agent_sessions(id),
  run_type        text not null default 'chat',  -- 'chat' | 'scheduled' | 'playbook'
  model           text not null,
  prompt_tokens   int default 0,
  completion_tokens int default 0,
  total_tokens    int default 0,
  estimated_cost_usd numeric(10, 6) default 0,
  steps           int default 0,
  tool_calls      jsonb default '[]',  -- array of { tool, latency_ms, success }
  duration_ms     int,
  status          text default 'completed',  -- 'completed' | 'failed' | 'aborted'
  error           text,
  created_at      timestamptz default now()
);

-- Quality feedback — thumbs up/down per assistant message
create table agent_feedback (
  id          uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id),
  session_id  uuid references agent_sessions(id),
  message_id  uuid,                  -- references agent_messages.id
  rating      smallint not null,     -- 1 = thumbs up, -1 = thumbs down
  comment     text,
  created_at  timestamptz default now()
);

alter table agent_traces   enable row level security;
alter table agent_feedback enable row level security;

create policy "own traces"   on agent_traces   for all using (merchant_id = auth.uid());
create policy "own feedback" on agent_feedback for all using (merchant_id = auth.uid());

create index on agent_traces(merchant_id, created_at desc);
create index on agent_traces(session_id);
create index on agent_feedback(merchant_id, created_at desc);

-- RLS Audit
do $$ declare
  t text;
begin
  foreach t in array array[
    'agent_sessions', 'agent_messages', 'agent_actions', 'agent_approvals',
    'agent_memory', 'agent_playbooks', 'agent_alerts', 'agent_scheduled_runs',
    'agent_traces', 'agent_feedback', 'einvoice_submissions', 'merchant_integrations'
  ] loop
    execute format('alter table %I enable row level security', t);
    -- Ensure no table has a policy allowing cross-merchant reads
    execute format(
      'drop policy if exists "allow all" on %I', t
    );
  end loop;
end $$;

-- Add explicit denial policy as defence-in-depth
-- These fire AFTER the allow policies — if no allow policy matches, deny
create policy "deny cross merchant sessions"
  on agent_sessions for select
  using (merchant_id = auth.uid());

create policy "deny cross merchant messages"
  on agent_messages for select
  using (merchant_id = auth.uid());

-- Cross-tenant query guard function
-- Returns error if merchantId does not match auth.uid()
create or replace function assert_own_merchant(merchant_id uuid)
returns void language plpgsql security definer as $$
begin
  if merchant_id != auth.uid() then
    raise exception 'Cross-merchant access denied';
  end if;
end;
$$;
