-- BODHA individual-learning MVP schema.
-- Product auth/database is Supabase Auth + PostgreSQL only.
-- RLS is mandatory on every product table. Owner is auth.uid().

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helper: current user (never trust client-supplied owner IDs)
-- ---------------------------------------------------------------------------
create or replace function public.bodha_uid()
returns uuid
language sql
stable
as $$
  select auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy profiles_insert_own
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy profiles_update_own
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke all on public.profiles from anon, public;
grant select, insert, update on public.profiles to authenticated;

-- Auto-create profile on signup (constrained security definer)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- LLM BYOK settings. encrypted_api_key is ciphertext, never plaintext.
-- ---------------------------------------------------------------------------
create table public.llm_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  provider text not null,
  model text not null,
  base_url text not null,
  encrypted_api_key text not null,
  encryption_iv text not null,
  encryption_tag text not null,
  key_fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint llm_settings_provider_len check (char_length(provider) between 1 and 64),
  constraint llm_settings_model_len check (char_length(model) between 1 and 200),
  constraint llm_settings_base_url_len check (char_length(base_url) between 8 and 500)
);

alter table public.llm_settings enable row level security;

create policy llm_settings_select_own
  on public.llm_settings for select to authenticated
  using (user_id = auth.uid());

create policy llm_settings_insert_own
  on public.llm_settings for insert to authenticated
  with check (user_id = auth.uid());

create policy llm_settings_update_own
  on public.llm_settings for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy llm_settings_delete_own
  on public.llm_settings for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.llm_settings from anon, public;
grant select, insert, update, delete on public.llm_settings to authenticated;

-- Owner-safe view excludes ciphertext (security_invoker so RLS still applies)
create view public.llm_settings_status
with (security_invoker = true) as
select
  user_id,
  provider,
  model,
  base_url,
  key_fingerprint,
  created_at,
  updated_at
from public.llm_settings;

grant select on public.llm_settings_status to authenticated;
revoke all on public.llm_settings_status from anon, public;

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null,
  status text not null,
  files jsonb not null default '{}'::jsonb,
  timezone text not null default 'UTC',
  consent_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  save_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sessions_status_check check (
    status in (
      'pending_consent',
      'running',
      'finalizing',
      'complete',
      'cancelled',
      'failed',
      'incomplete'
    )
  ),
  constraint sessions_exercise_id_check check (exercise_id ~ '^[a-z0-9-]+$'),
  unique (id, user_id)
);

create index sessions_user_created_idx on public.sessions (user_id, created_at desc);
create index sessions_user_status_idx on public.sessions (user_id, status);

alter table public.sessions enable row level security;

create policy sessions_select_own
  on public.sessions for select to authenticated
  using (user_id = auth.uid());

create policy sessions_insert_own
  on public.sessions for insert to authenticated
  with check (user_id = auth.uid());

create policy sessions_update_own
  on public.sessions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No anonymous access. No owner reassignment (WITH CHECK user_id = auth.uid()).
revoke all on public.sessions from anon, public;
grant select, insert, update on public.sessions to authenticated;

-- ---------------------------------------------------------------------------
-- Immutable exercise snapshots (no owner UPDATE/DELETE)
-- ---------------------------------------------------------------------------
create table public.exercise_snapshots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null,
  exercise_id text not null,
  content_hash text not null,
  spec_markdown text not null,
  tests_source text not null,
  starter jsonb not null,
  meta jsonb not null,
  created_at timestamptz not null default now(),
  unique (session_id),
  unique (id, user_id),
  unique (id, session_id),
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete cascade
);

alter table public.exercise_snapshots enable row level security;

create policy snapshots_select_own
  on public.exercise_snapshots for select to authenticated
  using (user_id = auth.uid());

create policy snapshots_insert_own
  on public.exercise_snapshots for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.sessions s
      where s.id = exercise_snapshots.session_id and s.user_id = auth.uid()
    )
  );

-- Intentionally no UPDATE or DELETE policies: immutability is enforced by RLS.
-- Idempotent writes must INSERT and, on unique conflict, SELECT the existing
-- row. ON CONFLICT DO UPDATE is not granted and must not be used.

revoke all on public.exercise_snapshots from anon, public;
grant select, insert on public.exercise_snapshots to authenticated;

-- ---------------------------------------------------------------------------
-- Evidence events (append-only for owners)
-- ---------------------------------------------------------------------------
create table public.evidence_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null,
  seq bigint generated by default as identity,
  kind text not null,
  source text not null,
  observation_type text not null,
  payload jsonb not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (session_id, idempotency_key),
  unique (session_id, seq),
  unique (id, session_id),
  unique (id, user_id),
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete cascade,
  constraint evidence_kind_check check (
    kind in (
      'prompt',
      'assistant',
      'tool',
      'test_run',
      'system',
      'consent',
      'usage'
    )
  ),
  constraint evidence_source_check check (
    source in ('provider', 'browser', 'learner', 'server')
  )
);

create index evidence_session_seq_idx on public.evidence_events (session_id, seq);

alter table public.evidence_events enable row level security;

create policy evidence_select_own
  on public.evidence_events for select to authenticated
  using (user_id = auth.uid());

create policy evidence_insert_own
  on public.evidence_events for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.sessions s
      where s.id = evidence_events.session_id and s.user_id = auth.uid()
    )
  );

revoke all on public.evidence_events from anon, public;
grant select, insert on public.evidence_events to authenticated;

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null,
  evidence_id uuid,
  role text not null,
  content text not null,
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete cascade,
  foreign key (evidence_id, session_id) references public.evidence_events (id, session_id) on delete set null,
  constraint messages_role_check check (role in ('user', 'assistant', 'system', 'tool'))
);

create index messages_session_created_idx on public.messages (session_id, created_at);

alter table public.messages enable row level security;

create policy messages_select_own
  on public.messages for select to authenticated
  using (user_id = auth.uid());

create policy messages_insert_own
  on public.messages for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.sessions s
      where s.id = messages.session_id and s.user_id = auth.uid()
    )
  );

revoke all on public.messages from anon, public;
grant select, insert on public.messages to authenticated;

-- ---------------------------------------------------------------------------
-- Test runs (browser-observed)
-- ---------------------------------------------------------------------------
create table public.test_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null,
  snapshot_id uuid not null,
  evidence_id uuid,
  code_revision_hash text not null,
  results jsonb not null,
  fatal text,
  provenance text not null default 'browser_harness',
  created_at timestamptz not null default now(),
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete cascade,
  foreign key (snapshot_id, user_id) references public.exercise_snapshots (id, user_id),
  foreign key (snapshot_id, session_id) references public.exercise_snapshots (id, session_id),
  foreign key (evidence_id, session_id) references public.evidence_events (id, session_id)
);

create index test_runs_session_idx on public.test_runs (session_id, created_at);

alter table public.test_runs enable row level security;

create policy test_runs_select_own
  on public.test_runs for select to authenticated
  using (user_id = auth.uid());

create policy test_runs_insert_own
  on public.test_runs for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.sessions s
      where s.id = test_runs.session_id and s.user_id = auth.uid()
    )
    and exists (
      select 1 from public.exercise_snapshots snap
      where snap.id = test_runs.snapshot_id
        and snap.user_id = auth.uid()
        and snap.session_id = test_runs.session_id
    )
  );

revoke all on public.test_runs from anon, public;
grant select, insert on public.test_runs to authenticated;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null,
  snapshot_id uuid not null,
  version int not null default 1,
  status text not null,
  body jsonb,
  error text,
  created_at timestamptz not null default now(),
  unique (session_id, version),
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete cascade,
  foreign key (snapshot_id, user_id) references public.exercise_snapshots (id, user_id),
  foreign key (snapshot_id, session_id) references public.exercise_snapshots (id, session_id),
  constraint reports_status_check check (
    status in ('running', 'complete', 'failed', 'incomplete')
  )
);

create index reports_session_idx on public.reports (session_id, version);

alter table public.reports enable row level security;

create policy reports_select_own
  on public.reports for select to authenticated
  using (user_id = auth.uid());

create policy reports_insert_own
  on public.reports for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.sessions s
      where s.id = reports.session_id and s.user_id = auth.uid()
    )
    and exists (
      select 1 from public.exercise_snapshots snap
      where snap.id = reports.snapshot_id
        and snap.user_id = auth.uid()
        and snap.session_id = reports.session_id
    )
  );

create policy reports_update_own
  on public.reports for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.reports from anon, public;
grant select, insert, update on public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- Usage records
-- ---------------------------------------------------------------------------
create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null,
  operation_id text not null,
  agent_role text not null,
  input_tokens bigint,
  output_tokens bigint,
  cached_tokens bigint,
  cached_included_in_input boolean,
  coverage text not null,
  native jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, operation_id),
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete cascade,
  constraint usage_role_check check (agent_role in ('trainer', 'review')),
  constraint usage_coverage_check check (coverage in ('complete', 'partial', 'unknown'))
);

alter table public.usage_records enable row level security;

create policy usage_select_own
  on public.usage_records for select to authenticated
  using (user_id = auth.uid());

create policy usage_insert_own
  on public.usage_records for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.sessions s
      where s.id = usage_records.session_id and s.user_id = auth.uid()
    )
  );

revoke all on public.usage_records from anon, public;
grant select, insert on public.usage_records to authenticated;

-- Anon is denied only on BODHA product relations above. Do not revoke
-- unrelated tables in schema public.
