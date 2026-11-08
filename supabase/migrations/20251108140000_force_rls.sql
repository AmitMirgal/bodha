-- Additive: FORCE ROW LEVEL SECURITY so table owners cannot skip policies.
-- Superusers and BYPASSRLS roles still bypass; product queries must not use those roles.
-- Do not reset or regenerate the baseline. Apply only on an isolated project you control.

alter table public.profiles force row level security;
alter table public.llm_settings force row level security;
alter table public.sessions force row level security;
alter table public.exercise_snapshots force row level security;
alter table public.evidence_events force row level security;
alter table public.messages force row level security;
alter table public.reports force row level security;
alter table public.test_runs force row level security;
alter table public.usage_records force row level security;
