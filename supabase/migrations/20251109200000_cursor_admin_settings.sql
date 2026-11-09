-- Optional Cursor Admin API key, encrypted like BYOK llm_settings.
-- Additive. Do not apply remotely from this agent.

create table public.cursor_admin_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  encrypted_api_key text not null,
  encryption_iv text not null,
  encryption_tag text not null,
  key_fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cursor_admin_settings enable row level security;
alter table public.cursor_admin_settings force row level security;

create policy cursor_admin_settings_select_own
  on public.cursor_admin_settings for select to authenticated
  using (user_id = auth.uid());

create policy cursor_admin_settings_insert_own
  on public.cursor_admin_settings for insert to authenticated
  with check (user_id = auth.uid());

create policy cursor_admin_settings_update_own
  on public.cursor_admin_settings for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy cursor_admin_settings_delete_own
  on public.cursor_admin_settings for delete to authenticated
  using (user_id = auth.uid());

revoke all on public.cursor_admin_settings from anon, public;
grant select, insert, update, delete on public.cursor_admin_settings to authenticated;
