import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const SESSION_A = "11111111-1111-4111-8111-111111111111";
export const SESSION_B = "22222222-2222-4222-8222-222222222222";
export const SNAP_A = "33333333-3333-4333-8333-333333333333";
export const EVIDENCE_A = "44444444-4444-4444-8444-444444444444";

const MIGRATIONS_DIR = fileURLToPath(
	new URL("../../../prisma/migrations/", import.meta.url)
);
const PGCRYPTO_EXT = /create extension if not exists pgcrypto;/gi;
const AUTH_USER_TRIGGER =
	/-- MATI_AUTH_TRIGGER_BEGIN[\s\S]*?-- MATI_AUTH_TRIGGER_END/g;
const MIGRATION_DIR_NAME = /^\d{14}_/;

export function prismaMigrationNames(): string[] {
	return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.filter((name) => MIGRATION_DIR_NAME.test(name))
		.sort();
}

export function prismaMigrationSql(name: string): string {
	return readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf8");
}

export function migrationSql(): string {
	return prismaMigrationNames()
		.map((name) => prismaMigrationSql(name))
		.join("\n")
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
alter table public.devices force row level security;
alter table public.capture_tasks force row level security;
alter table public.capture_events force row level security;
alter table public.capture_usage force row level security;
alter table public.pairing_codes force row level security;
alter table public.cursor_admin_settings force row level security;
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
grant usage, select on all sequences in schema public to authenticated, device, capture_register, capture_janitor;
`;

export function asDevice(deviceId: string, pairingHash?: string): string {
	const claims = JSON.stringify({
		device_id: deviceId,
		pairing_code_hash: pairingHash ?? null,
		role: "device",
	}).replace(/'/g, "''");
	return `select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claims', '${claims}', false)`;
}

export function asUser(id: string): string {
	// Session-level (is_local=false): PGlite commits each statement.
	const claims = JSON.stringify({ sub: id, role: "authenticated" }).replace(
		/'/g,
		"''"
	);
	return `select set_config('request.jwt.claim.sub', '${id}', false);
select set_config('request.jwt.claims', '${claims}', false)`;
}
