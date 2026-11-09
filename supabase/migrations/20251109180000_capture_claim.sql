-- Capture claim, deletion, and unclaimed TTL. Additive. Do not apply remotely from this agent.

do $$ begin
  create role capture_janitor nologin nosuperuser nobypassrls;
exception when duplicate_object then null;
end $$;

grant usage on schema public to capture_janitor;
grant usage on schema auth to capture_janitor;
grant execute on function auth.uid() to capture_janitor;
grant capture_janitor to current_user;

create or replace function public.mati_consume_pairing_code(p_code_hash text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if p_code_hash is null or char_length(p_code_hash) <> 64 then
    return null;
  end if;
  update public.pairing_codes
     set consumed_at = now()
   where id = (
     select id
     from public.pairing_codes
     where code_hash = p_code_hash
       and consumed_at is null
       and expires_at > now()
     order by created_at desc
     limit 1
     for update
   )
  returning user_id into v_user;
  return v_user;
end;
$$;

revoke all on function public.mati_consume_pairing_code(text) from public;
grant execute on function public.mati_consume_pairing_code(text) to device;

create table public.pairing_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint pairing_codes_hash_len check (char_length(code_hash) = 64)
);

create index pairing_codes_hash_idx
  on public.pairing_codes (code_hash)
  where consumed_at is null;

create index devices_unclaimed_created_idx
  on public.devices (created_at)
  where claimed_user_id is null;

alter table public.pairing_codes enable row level security;
alter table public.pairing_codes force row level security;

create policy pairing_codes_user_insert
  on public.pairing_codes for insert to authenticated
  with check (user_id = auth.uid());

create policy pairing_codes_user_select
  on public.pairing_codes for select to authenticated
  using (user_id = auth.uid());

create policy pairing_codes_user_update
  on public.pairing_codes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy pairing_codes_user_delete
  on public.pairing_codes for delete to authenticated
  using (user_id = auth.uid());

create policy devices_user_delete
  on public.devices for delete to authenticated
  using (claimed_user_id = auth.uid());

create policy capture_tasks_user_delete
  on public.capture_tasks for delete to authenticated
  using (user_id = auth.uid());

create policy capture_events_user_delete
  on public.capture_events for delete to authenticated
  using (user_id = auth.uid());

create policy capture_usage_user_delete
  on public.capture_usage for delete to authenticated
  using (user_id = auth.uid());

create policy devices_janitor_select
  on public.devices for select to capture_janitor
  using (
    claimed_user_id is null
    and created_at < now() - interval '90 days'
  );

create policy devices_janitor_delete
  on public.devices for delete to capture_janitor
  using (
    claimed_user_id is null
    and created_at < now() - interval '90 days'
  );

create policy capture_tasks_janitor_select
  on public.capture_tasks for select to capture_janitor
  using (
    user_id is null
    and device_id in (
      select id from public.devices
      where claimed_user_id is null
        and created_at < now() - interval '90 days'
    )
  );

create policy capture_tasks_janitor_delete
  on public.capture_tasks for delete to capture_janitor
  using (
    user_id is null
    and device_id in (
      select id from public.devices
      where claimed_user_id is null
        and created_at < now() - interval '90 days'
    )
  );

create policy capture_events_janitor_select
  on public.capture_events for select to capture_janitor
  using (
    user_id is null
    and device_id in (
      select id from public.devices
      where claimed_user_id is null
        and created_at < now() - interval '90 days'
    )
  );

create policy capture_events_janitor_delete
  on public.capture_events for delete to capture_janitor
  using (
    user_id is null
    and device_id in (
      select id from public.devices
      where claimed_user_id is null
        and created_at < now() - interval '90 days'
    )
  );

create policy capture_usage_janitor_select
  on public.capture_usage for select to capture_janitor
  using (
    user_id is null
    and device_id in (
      select id from public.devices
      where claimed_user_id is null
        and created_at < now() - interval '90 days'
    )
  );

create policy capture_usage_janitor_delete
  on public.capture_usage for delete to capture_janitor
  using (
    user_id is null
    and device_id in (
      select id from public.devices
      where claimed_user_id is null
        and created_at < now() - interval '90 days'
    )
  );

revoke all on public.pairing_codes from anon, public;
grant insert, select, update, delete on public.pairing_codes to authenticated;
grant delete on public.devices to authenticated;
grant delete on public.capture_tasks to authenticated;
grant delete on public.capture_events to authenticated;
grant delete on public.capture_usage to authenticated;
grant select, delete on public.devices to capture_janitor;
grant select, delete on public.capture_tasks to capture_janitor;
grant select, delete on public.capture_events to capture_janitor;
grant select, delete on public.capture_usage to capture_janitor;
grant usage, select on all sequences in schema public to capture_janitor;
grant execute on function public.mati_device_id() to capture_janitor;
