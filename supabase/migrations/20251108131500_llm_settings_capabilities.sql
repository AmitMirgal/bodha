-- Additive for isolated local projects that already applied 20251108120000.
-- Do not apply to production or unrelated Supabase projects from this agent.

alter table public.llm_settings
  add column if not exists capabilities jsonb not null default '{"tools":"unknown","structuredOutput":"unknown","streaming":"unknown","usageReporting":"unknown"}'::jsonb;

create or replace view public.llm_settings_status
with (security_invoker = true) as
select
  user_id,
  provider,
  model,
  base_url,
  key_fingerprint,
  capabilities,
  created_at,
  updated_at
from public.llm_settings;

grant select on public.llm_settings_status to authenticated;
revoke all on public.llm_settings_status from anon, public;
