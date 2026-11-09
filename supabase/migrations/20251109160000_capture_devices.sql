-- Editor capture tables. Unclaimed rows are owned by a device token, not auth.uid().
-- Additive. Do not apply to a remote project from this agent.

do $$ begin
  create role device nologin nosuperuser nobypassrls;
exception when duplicate_object then null;
end $$;

do $$ begin
  create role capture_register nologin nosuperuser nobypassrls;
exception when duplicate_object then null;
end $$;

grant usage on schema public to device, capture_register;
grant usage on schema auth to device, capture_register;
grant execute on function auth.uid() to device, capture_register;
grant device to current_user;
grant capture_register to current_user;

create or replace function public.mati_device_id()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claims', true), ''),
      '{}'
    )::json->>'device_id',
    ''
  )::uuid
$$;

revoke all on function public.mati_device_id() from public;
grant execute on function public.mati_device_id() to device, authenticated, capture_register, anon;

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  claimed_user_id uuid null references public.profiles (id) on delete set null,
  consent jsonb not null,
  created_at timestamptz not null default now(),
  constraint devices_token_hash_len check (char_length(token_hash) = 64),
  constraint devices_consent_object check (jsonb_typeof(consent) = 'object')
);

create table public.capture_tasks (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  user_id uuid null references public.profiles (id) on delete set null,
  editor text not null,
  editor_task_id text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  workspace_hash text not null,
  created_at timestamptz not null default now(),
  constraint capture_tasks_editor_check check (editor in ('cursor', 'vscode')),
  constraint capture_tasks_status_check check (status in ('open', 'closed')),
  constraint capture_tasks_editor_task_id_len check (char_length(editor_task_id) between 1 and 200),
  constraint capture_tasks_workspace_hash_len check (char_length(workspace_hash) between 1 and 128),
  unique (device_id, editor, editor_task_id)
);

create table public.capture_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.capture_tasks (id) on delete cascade,
  device_id uuid not null references public.devices (id) on delete cascade,
  user_id uuid null references public.profiles (id) on delete set null,
  kind text not null,
  payload jsonb not null,
  idempotency_key text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint capture_events_kind_check check (
    kind in ('prompt', 'response', 'file_edit', 'context_compact', 'usage', 'session_end')
  ),
  constraint capture_events_idempotency_len check (char_length(idempotency_key) between 1 and 300),
  unique (device_id, idempotency_key)
);

create table public.capture_usage (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.capture_tasks (id) on delete cascade,
  device_id uuid not null references public.devices (id) on delete cascade,
  user_id uuid null references public.profiles (id) on delete set null,
  operation_id text not null,
  provenance text not null,
  source text not null,
  input_tokens bigint null,
  output_tokens bigint null,
  cached_tokens bigint null,
  reasoning_tokens bigint null,
  model text null,
  native jsonb null,
  created_at timestamptz not null default now(),
  constraint capture_usage_provenance_check check (provenance in ('measured', 'estimated', 'missing')),
  constraint capture_usage_source_check check (
    source in ('copilot_otel_chat_span', 'cursor_admin_api', 'text_estimate', 'none')
  ),
  unique (task_id, operation_id)
);

create index capture_tasks_device_idx on public.capture_tasks (device_id, started_at desc);
create index capture_events_task_idx on public.capture_events (task_id, occurred_at);
create index capture_usage_task_idx on public.capture_usage (task_id);

alter table public.devices enable row level security;
alter table public.capture_tasks enable row level security;
alter table public.capture_events enable row level security;
alter table public.capture_usage enable row level security;
alter table public.devices force row level security;
alter table public.capture_tasks force row level security;
alter table public.capture_events force row level security;
alter table public.capture_usage force row level security;

create policy devices_register_insert
  on public.devices for insert to capture_register
  with check (true);

create policy devices_register_select
  on public.devices for select to capture_register
  using (true);

create policy devices_device_select
  on public.devices for select to device
  using (id = public.mati_device_id());

create policy devices_device_update
  on public.devices for update to device
  using (id = public.mati_device_id())
  with check (id = public.mati_device_id());

create policy devices_device_delete
  on public.devices for delete to device
  using (id = public.mati_device_id());

create policy devices_user_select
  on public.devices for select to authenticated
  using (claimed_user_id = auth.uid());

create policy capture_tasks_device_all
  on public.capture_tasks for all to device
  using (device_id = public.mati_device_id())
  with check (device_id = public.mati_device_id());

create policy capture_events_device_all
  on public.capture_events for all to device
  using (device_id = public.mati_device_id())
  with check (device_id = public.mati_device_id());

create policy capture_usage_device_all
  on public.capture_usage for all to device
  using (device_id = public.mati_device_id())
  with check (device_id = public.mati_device_id());

create policy capture_tasks_user_select
  on public.capture_tasks for select to authenticated
  using (user_id = auth.uid());

create policy capture_events_user_select
  on public.capture_events for select to authenticated
  using (user_id = auth.uid());

create policy capture_usage_user_select
  on public.capture_usage for select to authenticated
  using (user_id = auth.uid());

revoke all on public.devices from anon, public;
revoke all on public.capture_tasks from anon, public;
revoke all on public.capture_events from anon, public;
revoke all on public.capture_usage from anon, public;

grant insert, select on public.devices to capture_register;
grant select, update, delete on public.devices to device;
grant select, insert, update, delete on public.capture_tasks to device;
grant select, insert, update, delete on public.capture_events to device;
grant select, insert, update, delete on public.capture_usage to device;
grant select on public.devices to authenticated;
grant select on public.capture_tasks to authenticated;
grant select on public.capture_events to authenticated;
grant select on public.capture_usage to authenticated;
grant usage, select on all sequences in schema public to device, capture_register;
