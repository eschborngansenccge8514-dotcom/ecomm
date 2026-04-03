-- Agent schema — idempotent (safe to run even if tables already exist)
-- These tables were previously created manually; this migration makes them
-- part of the tracked schema so fresh deployments work correctly.

-- Require pgvector for agent_memory embeddings
create extension if not exists vector;

-- 1. Conversation sessions
create table if not exists agent_sessions (
  id          uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id),
  title       text,
  status      text not null default 'active',
  summary     text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 2. Message history
create table if not exists agent_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references agent_sessions(id) on delete cascade,
  merchant_id uuid not null references auth.users(id),
  role        text not null,
  content     text not null,
  created_at  timestamptz default now()
);

-- 3. Audit log (every tool call)
create table if not exists agent_actions (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid references agent_sessions(id),
  merchant_id  uuid not null references auth.users(id),
  tool_name    text not null,
  input        jsonb,
  output       jsonb,
  risk_level   text not null default 'low',
  status       text not null default 'executed',
  snapshot     jsonb,
  triggered_by text not null default 'agent',
  executed_at  timestamptz default now()
);

-- 4. Approval queue (high-risk actions pending merchant confirmation)
create table if not exists agent_approvals (
  id            uuid primary key default gen_random_uuid(),
  action_id     uuid not null references agent_actions(id),
  merchant_id   uuid not null references auth.users(id),
  risk_level    text not null,
  title         text not null,
  description   text not null,
  tool_name     text not null,
  tool_input    jsonb,
  status        text not null default 'pending',
  approved_by   uuid references auth.users(id),
  reject_reason text,
  created_at    timestamptz default now(),
  resolved_at   timestamptz
);

-- 5. Long-term memory (vector embeddings per merchant)
create table if not exists agent_memory (
  id          uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id),
  type        text not null,
  content     text not null,
  embedding   vector(768),
  created_at  timestamptz default now()
);

-- 6. Automation playbooks
create table if not exists agent_playbooks (
  id               uuid primary key default gen_random_uuid(),
  merchant_id      uuid not null references auth.users(id),
  name             text not null,
  description      text,
  steps            text[] not null,
  schedule         jsonb not null,
  is_active        boolean default true,
  last_run_at      timestamptz,
  last_run_status  text,
  last_run_summary text,
  created_at       timestamptz default now(),
  unique (merchant_id, name)
);

-- 7. Proactive alerts pushed to dashboard
create table if not exists agent_alerts (
  id          uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references auth.users(id),
  session_id  uuid references agent_sessions(id),
  title       text not null,
  body        text not null,
  severity    text not null,
  category    text not null,
  action      jsonb,
  is_read     boolean default false,
  created_at  timestamptz default now()
);

-- 8. Scheduled run log
create table if not exists agent_scheduled_runs (
  id            uuid primary key default gen_random_uuid(),
  merchant_id   uuid not null references auth.users(id),
  playbook_id   uuid references agent_playbooks(id),
  run_type      text not null,
  status        text not null default 'running',
  summary       text,
  alerts_pushed int default 0,
  actions_taken int default 0,
  started_at    timestamptz default now(),
  completed_at  timestamptz
);

-- Indexes
create index if not exists agent_sessions_merchant_idx     on agent_sessions(merchant_id, created_at desc);
create index if not exists agent_messages_session_idx      on agent_messages(session_id, created_at asc);
create index if not exists agent_actions_merchant_idx      on agent_actions(merchant_id, executed_at desc);
create index if not exists agent_approvals_merchant_idx    on agent_approvals(merchant_id, status);
create index if not exists agent_alerts_merchant_idx       on agent_alerts(merchant_id, created_at desc);
create index if not exists agent_scheduled_runs_merchant   on agent_scheduled_runs(merchant_id, started_at desc);
create index if not exists agent_memory_embedding_idx      on agent_memory using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- RLS
alter table agent_sessions       enable row level security;
alter table agent_messages       enable row level security;
alter table agent_actions        enable row level security;
alter table agent_approvals      enable row level security;
alter table agent_memory         enable row level security;
alter table agent_playbooks      enable row level security;
alter table agent_alerts         enable row level security;
alter table agent_scheduled_runs enable row level security;

-- Policies (idempotent)
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'agent_sessions'  and policyname = 'own sessions')  then
    create policy "own sessions"  on agent_sessions  for all using (merchant_id = auth.uid()); end if;
  if not exists (select 1 from pg_policies where tablename = 'agent_messages'  and policyname = 'own messages')  then
    create policy "own messages"  on agent_messages  for all using (merchant_id = auth.uid()); end if;
  if not exists (select 1 from pg_policies where tablename = 'agent_actions'   and policyname = 'own actions')   then
    create policy "own actions"   on agent_actions   for all using (merchant_id = auth.uid()); end if;
  if not exists (select 1 from pg_policies where tablename = 'agent_approvals' and policyname = 'own approvals') then
    create policy "own approvals" on agent_approvals for all using (merchant_id = auth.uid()); end if;
  if not exists (select 1 from pg_policies where tablename = 'agent_memory'    and policyname = 'own memory')    then
    create policy "own memory"    on agent_memory    for all using (merchant_id = auth.uid()); end if;
  if not exists (select 1 from pg_policies where tablename = 'agent_playbooks' and policyname = 'own playbooks') then
    create policy "own playbooks" on agent_playbooks for all using (merchant_id = auth.uid()); end if;
  if not exists (select 1 from pg_policies where tablename = 'agent_alerts'    and policyname = 'own alerts')    then
    create policy "own alerts"    on agent_alerts    for all using (merchant_id = auth.uid()); end if;
  if not exists (select 1 from pg_policies where tablename = 'agent_scheduled_runs' and policyname = 'own scheduled runs') then
    create policy "own scheduled runs" on agent_scheduled_runs for all using (merchant_id = auth.uid()); end if;
end $$;

-- Vector similarity search for long-term memory retrieval
create or replace function match_agent_memory(
  query_embedding  vector(768),
  merchant_id_arg  uuid,
  match_count      int default 5
)
returns table (id uuid, content text, type text, similarity float)
language sql stable as $$
  select id, content, type,
    1 - (embedding <=> query_embedding) as similarity
  from agent_memory
  where merchant_id = merchant_id_arg
  order by embedding <=> query_embedding
  limit match_count;
$$;
