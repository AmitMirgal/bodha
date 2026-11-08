import { readFileSync } from "node:fs";

export const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const SESSION_A = "11111111-1111-4111-8111-111111111111";
export const SESSION_B = "22222222-2222-4222-8222-222222222222";
export const SNAP_A = "33333333-3333-4333-8333-333333333333";
export const EVIDENCE_A = "44444444-4444-4444-8444-444444444444";

const MIGRATION_PATH = new URL(
	"../../../../../supabase/migrations/20251108120000_bodha_mvp.sql",
	import.meta.url
);
const PGCRYPTO_EXT = /create extension if not exists pgcrypto;/i;
const AUTH_USER_TRIGGER = /create trigger on_auth_user_created[\s\S]*?;/;

export function migrationSql(): string {
	return readFileSync(MIGRATION_PATH, "utf8")
		.replace(PGCRYPTO_EXT, "")
		.replace(AUTH_USER_TRIGGER, "");
}

export const AUTH_STUB = `
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key,
  email text
);
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::json->>'sub'
  )::uuid
$$;
`;

export const FORCE_RLS = `
alter table public.profiles force row level security;
alter table public.llm_settings force row level security;
alter table public.sessions force row level security;
alter table public.exercise_snapshots force row level security;
alter table public.evidence_events force row level security;
alter table public.messages force row level security;
alter table public.test_runs force row level security;
alter table public.reports force row level security;
alter table public.usage_records force row level security;
`;

export const CREATE_ROLES = `
do $$ begin
  create role authenticated nologin nosuperuser nobypassrls;
exception when duplicate_object then null;
end $$;
do $$ begin
  create role anon nologin nosuperuser nobypassrls;
exception when duplicate_object then null;
end $$;
grant usage on schema public to authenticated, anon;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
grant authenticated to current_user;
grant anon to current_user;
`;

export const GRANT_SEQUENCES = `
grant usage, select on all sequences in schema public to authenticated;
`;

export function asUser(id: string): string {
	// Session-level (is_local=false): PGlite commits each statement.
	const claims = JSON.stringify({ sub: id, role: "authenticated" }).replace(
		/'/g,
		"''"
	);
	return `select set_config('request.jwt.claim.sub', '${id}', false);
select set_config('request.jwt.claims', '${claims}', false)`;
}
