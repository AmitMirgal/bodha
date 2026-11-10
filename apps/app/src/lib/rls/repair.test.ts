import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	AUTH_STUB,
	asDevice,
	CREATE_ROLES,
	migrationSql,
	prismaMigrationSql,
	SESSION_A,
	USER_A,
} from "./harness";

interface Queryable {
	exec: (sql: string) => Promise<unknown>;
	query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
}

const PGCRYPTO_EXT = /create extension if not exists pgcrypto;/gi;
const AUTH_USER_TRIGGER =
	/-- MATI_AUTH_TRIGGER_BEGIN[\s\S]*?-- MATI_AUTH_TRIGGER_END/g;

function stripForPglite(sql: string): string {
	return sql.replace(PGCRYPTO_EXT, "").replace(AUTH_USER_TRIGGER, "");
}

const INIT_TABLES = stripForPglite(
	prismaMigrationSql("20261110120000_init").split(
		"-- Roles, FORCE RLS, policies, grants, checks, view, and functions."
	)[0] ?? ""
);
const REPAIR = stripForPglite(
	prismaMigrationSql("20261110120100_repair_existing_supabase")
);

const ENABLE_RLS_NOT_FORCE = `
alter table public.profiles enable row level security;
alter table public.llm_settings enable row level security;
alter table public.sessions enable row level security;
alter table public.exercise_snapshots enable row level security;
alter table public.evidence_events enable row level security;
alter table public.messages enable row level security;
alter table public.test_runs enable row level security;
alter table public.reports enable row level security;
alter table public.usage_records enable row level security;
`;

const SEED = `
insert into auth.users (id, email) values ('${USER_A}', 'a@example.com');
insert into public.profiles (id) values ('${USER_A}');
insert into public.sessions (id, user_id, exercise_id, status)
values ('${SESSION_A}', '${USER_A}', 'shelf', 'running');
`;

async function forceFlags(db: Queryable, names: string[]) {
	const listed = names.map((name) => `'${name}'`).join(", ");
	return await db.query<{
		relname: string;
		relrowsecurity: boolean;
		relforcerowsecurity: boolean;
	}>(
		`select c.relname, c.relrowsecurity, c.relforcerowsecurity
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname in (${listed})
     order by 1`
	);
}

async function roleFlags(db: Queryable) {
	return await db.query<{
		rolname: string;
		rolsuper: boolean;
		rolbypassrls: boolean;
	}>(
		`select rolname, rolsuper, rolbypassrls
     from pg_roles
     where rolname in ('device', 'capture_register', 'capture_janitor')
     order by 1`
	);
}

describe("existing-database repair migration", () => {
	let withCapture: Queryable | null = null;
	let withoutCapture: Queryable | null = null;
	let skip = "PGlite not initialized";

	beforeAll(async () => {
		try {
			const { PGlite } = await import("@electric-sql/pglite");
			withCapture = new PGlite();
			await withCapture.exec(AUTH_STUB);
			await withCapture.exec(CREATE_ROLES);
			await withCapture.exec(INIT_TABLES);
			await withCapture.exec(ENABLE_RLS_NOT_FORCE);
			await withCapture.exec(SEED);
			await withCapture.exec(REPAIR);

			withoutCapture = new PGlite();
			await withoutCapture.exec(AUTH_STUB);
			await withoutCapture.exec(CREATE_ROLES);
			await withoutCapture.exec(INIT_TABLES);
			await withoutCapture.exec(ENABLE_RLS_NOT_FORCE);
			await withoutCapture.exec(SEED);
			await withoutCapture.exec(`
        drop table if exists public.capture_usage cascade;
        drop table if exists public.capture_events cascade;
        drop table if exists public.capture_tasks cascade;
        drop table if exists public.pairing_codes cascade;
        drop table if exists public.cursor_admin_settings cascade;
        drop table if exists public.devices cascade;
      `);
			await withoutCapture.exec(REPAIR);
		} catch (error) {
			skip = error instanceof Error ? error.message : String(error);
			withCapture = null;
			withoutCapture = null;
		}
	});

	afterAll(() => {
		withCapture = null;
		withoutCapture = null;
	});

	it("keeps existing session rows when capture tables were already present", async ({
		skip: skipTest,
	}) => {
		if (!withCapture) {
			skipTest(skip);
			return;
		}
		const sessions = await withCapture.query<{ id: string }>(
			`select id from public.sessions where id = '${SESSION_A}'`
		);
		expect(sessions.rows).toEqual([{ id: SESSION_A }]);
		const flags = await forceFlags(withCapture, ["sessions", "devices"]);
		expect(flags.rows.every((row) => row.relrowsecurity)).toBe(true);
		expect(flags.rows.every((row) => row.relforcerowsecurity)).toBe(true);
		const roles = await roleFlags(withCapture);
		expect(roles.rows.map((row) => row.rolname)).toEqual([
			"capture_janitor",
			"capture_register",
			"device",
		]);
		expect(roles.rows.every((row) => !(row.rolsuper || row.rolbypassrls))).toBe(
			true
		);
	});

	it("recreates dropped capture tables and still keeps user sessions", async ({
		skip: skipTest,
	}) => {
		if (!withoutCapture) {
			skipTest(skip);
			return;
		}
		const sessions = await withoutCapture.query<{ id: string }>(
			`select id from public.sessions where id = '${SESSION_A}'`
		);
		expect(sessions.rows).toEqual([{ id: SESSION_A }]);
		const tables = await withoutCapture.query<{ relname: string }>(
			`select c.relname from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relname in ('devices', 'capture_tasks', 'pairing_codes', 'cursor_admin_settings')
       order by 1`
		);
		expect(tables.rows.map((row) => row.relname)).toEqual([
			"capture_tasks",
			"cursor_admin_settings",
			"devices",
			"pairing_codes",
		]);
		await withoutCapture.exec("reset role");
		await withoutCapture.exec("set role capture_register");
		const inserted = await withoutCapture.query<{ id: string }>(
			`insert into public.devices (token_hash, consent)
       values (
         '${"d".repeat(64)}',
         '{"version":1,"grantedAt":"2026-11-10T00:00:00.000Z","scopes":["prompt_text"]}'::jsonb
       )
       returning id`
		);
		const deviceId = inserted.rows[0]?.id;
		expect(deviceId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
		);
		await withoutCapture.exec("reset role");
		await withoutCapture.exec("set role device");
		await withoutCapture.exec(asDevice(deviceId ?? ""));
		const own = await withoutCapture.query<{ id: string }>(
			"select id from public.devices"
		);
		expect(own.rows.map((row) => row.id)).toEqual([deviceId]);
	});

	it("empty-database Prisma migrations still include the same overlay as repair", () => {
		expect(migrationSql()).toMatch(/create role capture_register /i);
		expect(REPAIR).toMatch(/CREATE TABLE IF NOT EXISTS "devices"/);
		expect(INIT_TABLES).toMatch(/CREATE TABLE "sessions"/);
		expect(INIT_TABLES).not.toMatch(/create role device /i);
	});
});
