-- Additive: constrain llm_settings.provider to the five Mati providers and
-- stop requiring base_url. Official endpoints live in application adapters.
-- Do not drop base_url (existing rows keep whatever was stored).
-- Do not apply this to production from an agent. Isolated/preview only.

alter table public.llm_settings
  alter column base_url drop not null;

alter table public.llm_settings
  drop constraint if exists llm_settings_base_url_len;

alter table public.llm_settings
  add constraint llm_settings_provider_allowed
  check (provider in ('openai', 'anthropic', 'sarvam', 'xai', 'google'))
  not valid;

comment on column public.llm_settings.base_url is
  'Unused by Mati. Official provider endpoints are defined in application adapters. Left nullable so existing rows are not rewritten.';
