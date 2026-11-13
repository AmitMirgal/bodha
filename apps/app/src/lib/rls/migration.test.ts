import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { migrationSql, prismaMigrationNames } from "./harness";

const names = prismaMigrationNames();
const initName = names.find((name) => name.endsWith("_init"));
const repairName = names.find((name) =>
	name.endsWith("_repair_existing_supabase")
);
const grantAuthName = names.find((name) =>
	name.endsWith("_capture_roles_without_auth_schema")
);
const allSql = migrationSql();
const initSql = initName
	? readFileSync(
			new URL(
				`../../../prisma/migrations/${initName}/migration.sql`,
				import.meta.url
			),
			"utf8"
		)
	: "";
const repairSql = repairName
	? readFileSync(
			new URL(
				`../../../prisma/migrations/${repairName}/migration.sql`,
				import.meta.url
			),
			"utf8"
		)
	: "";
const config = readFileSync(
	new URL("../../../prisma.config.ts", import.meta.url),
	"utf8"
);

describe("Mati Prisma Migrate source of truth", () => {
	it("keeps Prisma Migrate history under apps/app/prisma/migrations", () => {
		expect(initName).toBe("20261110120000_init");
		expect(repairName).toBe("20261110120100_repair_existing_supabase");
		expect(grantAuthName).toBe(
			"20261110140000_capture_roles_without_auth_schema"
		);
		expect(names).toContain("20261110180000_device_claim_and_capture_reports");
		expect(names).toContain("20261113070000_gamification_v1");
		expect(
			existsSync(
				new URL(
					"../../../prisma/migrations/migration_lock.toml",
					import.meta.url
				)
			)
		).toBe(true);
	});

	it("does not keep supabase/migrations SQL as a second schema source", () => {
		expect(
			existsSync(
				new URL(
					"../../../../../supabase/migrations/20251108120000_bodha_mvp.sql",
					import.meta.url
				)
			)
		).toBe(false);
	});

	it("does not revoke anon on unrelated public tables", () => {
		expect(allSql).not.toMatch(
			/revoke all on all tables in schema public from anon/i
		);
	});

	it("qualifies test_runs and reports snapshot session checks", () => {
		expect(allSql).toMatch(/snap\.session_id = test_runs\.session_id/);
		expect(allSql).toMatch(/snap\.session_id = reports\.session_id/);
	});

	it("links messages and test evidence to the same session", () => {
		expect(initSql).toMatch(
			/"messages_evidence_id_session_id_fkey"[\s\S]*"evidence_events"\("id", "session_id"\)/
		);
		expect(initSql).toMatch(
			/"test_runs_snapshot_id_session_id_fkey"[\s\S]*"exercise_snapshots"\("id", "session_id"\)/
		);
	});

	it("persists probed LLM capabilities on llm_settings", () => {
		expect(allSql).toMatch(/capabilities jsonb not null/i);
		expect(allSql).toMatch(
			/create or replace view public\.llm_settings_status[\s\S]*capabilities/i
		);
	});

	it("grants insert-only on immutable evidence and snapshots", () => {
		expect(allSql).toMatch(
			/grant select, insert on public\.evidence_events to authenticated/i
		);
		expect(allSql).not.toMatch(
			/grant select, insert, update on public\.evidence_events/i
		);
		expect(allSql).toMatch(
			/grant select, insert on public\.exercise_snapshots to authenticated/i
		);
		expect(allSql).toMatch(
			/ON CONFLICT DO UPDATE is not granted and must not be used/
		);
	});

	it("forces RLS inside Prisma migrations, not a separate supabase SQL file", () => {
		expect(initSql).toMatch(/force row level security/i);
		expect(repairSql).toMatch(/force row level security/i);
		expect(initSql).toMatch(/prisma:migrate:deploy/i);
	});

	it("constrains providers without dropping base_url", () => {
		expect(allSql).toMatch(/llm_settings_provider_allowed/);
		expect(allSql).toMatch(/openai.*anthropic.*sarvam.*xai.*google/s);
		expect(allSql).toMatch(/alter column base_url drop not null/i);
		expect(allSql).not.toMatch(/drop column base_url/i);
	});

	it("adds capture tables with device RLS and no anon grants", () => {
		expect(initSql).toMatch(/create role device /i);
		expect(initSql).toMatch(/CREATE TABLE "capture_tasks"/);
		expect(initSql).toMatch(/force row level security/i);
		expect(initSql).toMatch(
			/grant insert, select on public.devices to capture_register/i
		);
		expect(initSql).not.toMatch(/grant .* on public.devices to anon/i);
		expect(initSql).not.toMatch(/with anon db/i);
	});

	it("adds pairing codes, claimed-user deletes, and a 90-day unclaimed janitor", () => {
		expect(initSql).toMatch(/CREATE TABLE "pairing_codes"/);
		expect(allSql).toMatch(/create role capture_janitor /i);
		expect(allSql).toMatch(/interval '90 days'/);
		expect(allSql).toMatch(/devices_user_delete/);
		expect(allSql).toMatch(/mati_consume_pairing_code/);
		expect(allSql).not.toMatch(/grant .* on public.pairing_codes to anon/i);
	});

	it("stores the optional Cursor Admin key encrypted like BYOK settings", () => {
		expect(initSql).toMatch(/CREATE TABLE "cursor_admin_settings"/);
		expect(initSql).toMatch(/encrypted_api_key/);
		expect(allSql).toMatch(/force row level security/i);
		expect(allSql).not.toMatch(
			/grant .* on public.cursor_admin_settings to anon/i
		);
	});

	it("repairs existing databases without dropping product tables", () => {
		expect(repairSql).toMatch(/CREATE TABLE IF NOT EXISTS "devices"/);
		expect(repairSql).toMatch(/CREATE TABLE IF NOT EXISTS "capture_tasks"/);
		expect(repairSql).toMatch(/CREATE TABLE IF NOT EXISTS "pairing_codes"/);
		expect(repairSql).not.toMatch(/drop table if exists/i);
		expect(repairSql).not.toMatch(/^\s*truncate /im);
		expect(repairSql).toMatch(/create role device /i);
		expect(repairSql).toMatch(/force row level security/i);
	});

	it("keeps capture-role policies and helpers off schema auth", () => {
		const capturePolicies = [
			...allSql.matchAll(
				/CREATE POLICY\s+\S+\s+ON\s+\S+\s+FOR\s+\S+\s+TO\s+(device|capture_register|capture_janitor)\b[\s\S]*?;/gi
			),
		].map((match) => match[0] ?? "");
		expect(capturePolicies.length).toBeGreaterThan(8);
		for (const policy of capturePolicies) {
			expect(policy).not.toMatch(/\bauth\./);
		}
		const deviceIdFn = allSql.match(
			/CREATE OR REPLACE FUNCTION public\.mati_device_id\(\)[\s\S]*?\$\$;/i
		)?.[0];
		const consumeFn = allSql.match(
			/CREATE OR REPLACE FUNCTION public\.mati_consume_pairing_code\([\s\S]*?\$\$;/i
		)?.[0];
		expect(deviceIdFn).toBeTruthy();
		expect(consumeFn).toBeTruthy();
		expect(deviceIdFn).not.toMatch(/\bauth\./);
		expect(consumeFn).not.toMatch(/\bauth\./);
		expect(allSql).toMatch(/EXCEPTION WHEN insufficient_privilege THEN NULL/);
	});

	it("adds hashed device claim tokens and user-owned capture reports", () => {
		expect(allSql).toMatch(/CREATE TABLE "device_claim_tokens"/);
		expect(allSql).toMatch(/CREATE TABLE "capture_reports"/);
		expect(allSql).toMatch(/mati_claim_device_with_token/);
		expect(allSql).toMatch(
			/GRANT EXECUTE ON FUNCTION public\.mati_claim_device_with_token\(text, uuid\) TO authenticated/
		);
		expect(allSql).not.toMatch(
			/GRANT EXECUTE ON FUNCTION public\.mati_claim_device_with_token\(text, uuid\) TO device/
		);
		expect(allSql).not.toMatch(
			/grant .* on public.device_claim_tokens to anon/i
		);
		expect(allSql).not.toMatch(/grant .* on public.capture_reports to anon/i);
		const claimFn = allSql.match(
			/CREATE OR REPLACE FUNCTION public\.mati_claim_device_with_token\([\s\S]*?\$\$;/i
		)?.[0];
		expect(claimFn).toMatch(/auth\.uid\(\)/);
		expect(claimFn).toMatch(/consumed_at/);
	});

	it("adds report opens, habit awards, and an opt-in leaderboard function", () => {
		expect(allSql).toMatch(/CREATE TABLE "capture_report_opens"/);
		expect(allSql).toMatch(/CREATE TABLE "leaderboard_profiles"/);
		expect(allSql).toMatch(/CREATE TABLE "habit_awards"/);
		expect(allSql).toMatch(/force row level security/i);
		expect(allSql).toMatch(/mati_leaderboard_week/);
		expect(allSql).toMatch(
			/GRANT EXECUTE ON FUNCTION public\.mati_leaderboard_week\(date, integer\) TO authenticated/
		);
		expect(allSql).not.toMatch(
			/GRANT EXECUTE ON FUNCTION public\.mati_leaderboard_week\(date, integer\) TO device/
		);
		expect(allSql).not.toMatch(
			/grant .* on public\.capture_report_opens to anon/i
		);
		expect(allSql).not.toMatch(
			/grant .* on public\.leaderboard_profiles to anon/i
		);
		expect(allSql).not.toMatch(/grant .* on public\.habit_awards to anon/i);
		const boardFn = allSql.match(
			/CREATE OR REPLACE FUNCTION public\.mati_leaderboard_week\([\s\S]*?\$\$;/i
		)?.[0];
		expect(boardFn).toMatch(/auth\.uid\(\)/);
		expect(boardFn).not.toMatch(/prompt/);
		expect(boardFn).not.toMatch(/email/);
		expect(boardFn).not.toMatch(/payload/);
	});

	it("points prisma.config.ts at DIRECT_URL and Prisma migrations", () => {
		expect(config).toMatch(/migrations:\s*\{/);
		expect(config).toMatch(/path:\s*"prisma\/migrations"/);
		expect(config).toMatch(/DIRECT_URL/);
		expect(config).not.toMatch(/process\.env\.DATABASE_URL/);
		expect(config).toMatch(/prisma migrate deploy/);
		expect(config).not.toMatch(/supabase\/migrations/);
	});
});
