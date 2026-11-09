import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
	new URL(
		"../../../../../supabase/migrations/20251108120000_bodha_mvp.sql",
		import.meta.url
	),
	"utf8"
);

describe("Mati migration source constraints", () => {
	it("does not revoke anon on unrelated public tables", () => {
		expect(migration).not.toMatch(
			/revoke all on all tables in schema public from anon/i
		);
	});

	it("qualifies test_runs and reports snapshot session checks", () => {
		expect(migration).toMatch(/snap\.session_id = test_runs\.session_id/);
		expect(migration).toMatch(/snap\.session_id = reports\.session_id/);
	});

	it("links messages and test evidence to the same session", () => {
		expect(migration).toMatch(
			/foreign key \(evidence_id, session_id\) references public\.evidence_events \(id, session_id\)/
		);
		expect(migration).toMatch(
			/foreign key \(snapshot_id, session_id\) references public\.exercise_snapshots \(id, session_id\)/
		);
	});

	it("persists probed LLM capabilities on llm_settings", () => {
		expect(migration).toMatch(/capabilities jsonb not null/);
		expect(migration).toMatch(
			/create view public\.llm_settings_status[\s\S]*capabilities/
		);
	});

	it("grants insert-only on immutable evidence and snapshots", () => {
		expect(migration).toMatch(
			/grant select, insert on public\.evidence_events to authenticated/
		);
		expect(migration).not.toMatch(
			/grant select, insert, update on public\.evidence_events/i
		);
		expect(migration).toMatch(
			/grant select, insert on public\.exercise_snapshots to authenticated/
		);
		expect(migration).toMatch(
			/ON CONFLICT DO UPDATE is not granted and must not be used/
		);
	});

	it("keeps FORCE RLS as an additive SQL file, not a Prisma migration", () => {
		const force = readFileSync(
			new URL(
				"../../../../../supabase/migrations/20251108140000_force_rls.sql",
				import.meta.url
			),
			"utf8"
		);
		expect(force).toMatch(/force row level security/i);
		expect(force).not.toMatch(/prisma migrate/i);
	});

	it("adds an additive provider constraint without dropping base_url", () => {
		const fixed = readFileSync(
			new URL(
				"../../../../../supabase/migrations/20251109090000_llm_settings_fixed_providers.sql",
				import.meta.url
			),
			"utf8"
		);
		expect(fixed).toMatch(/llm_settings_provider_allowed/);
		expect(fixed).toMatch(/openai.*anthropic.*sarvam.*xai.*google/s);
		expect(fixed).toMatch(/alter column base_url drop not null/);
		expect(fixed).not.toMatch(/drop column base_url/i);
	});

	it("adds capture tables with device RLS and no anon grants", () => {
		const capture = readFileSync(
			new URL(
				"../../../../../supabase/migrations/20251109160000_capture_devices.sql",
				import.meta.url
			),
			"utf8"
		);
		expect(capture).toMatch(/create role device /);
		expect(capture).toMatch(/create table public.capture_tasks/);
		expect(capture).toMatch(/force row level security/);
		expect(capture).toMatch(
			/grant insert, select on public.devices to capture_register/
		);
		expect(capture).not.toMatch(/grant .* on public.devices to anon/);
		expect(capture).not.toMatch(/with anon db/i);
	});

	it("adds pairing codes, claimed-user deletes, and a 90-day unclaimed janitor", () => {
		const claim = readFileSync(
			new URL(
				"../../../../../supabase/migrations/20251109180000_capture_claim.sql",
				import.meta.url
			),
			"utf8"
		);
		expect(claim).toMatch(/create table public.pairing_codes/);
		expect(claim).toMatch(/create role capture_janitor /);
		expect(claim).toMatch(/interval '90 days'/);
		expect(claim).toMatch(/devices_user_delete/);
		expect(claim).toMatch(/mati_consume_pairing_code/);
		expect(claim).not.toMatch(/grant .* on public.pairing_codes to anon/);
	});

	it("stores the optional Cursor Admin key encrypted like BYOK settings", () => {
		const admin = readFileSync(
			new URL(
				"../../../../../supabase/migrations/20251109200000_cursor_admin_settings.sql",
				import.meta.url
			),
			"utf8"
		);
		expect(admin).toMatch(/create table public.cursor_admin_settings/);
		expect(admin).toMatch(/encrypted_api_key/);
		expect(admin).toMatch(/force row level security/);
		expect(admin).not.toMatch(
			/grant .* on public.cursor_admin_settings to anon/
		);
	});

	it("does not keep a second Prisma Migrate history under apps/app/prisma/migrations", () => {
		const prismaMigrateDir = new URL(
			"../../../prisma/migrations",
			import.meta.url
		);
		expect(existsSync(prismaMigrateDir)).toBe(false);
	});

	it("points prisma.config.ts at DIRECT_URL and a Prisma 7 migrations.path", () => {
		const config = readFileSync(
			new URL("../../../prisma.config.ts", import.meta.url),
			"utf8"
		);
		expect(config).toMatch(/migrations:\s*\{/);
		expect(config).toMatch(/path:\s*"prisma\/migrations"/);
		expect(config).toMatch(/DIRECT_URL/);
		expect(config).not.toMatch(/process\.env\.DATABASE_URL/);
		expect(config).toMatch(/supabase\/migrations/);
	});
});
