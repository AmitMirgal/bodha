import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { ingestBatch } from "../capture/ingest";
import {
	claimDevice,
	startPairing,
	sweepUnclaimedDevices,
	UNCLAIMED_TTL_MS,
} from "../capture/pair";
import { createPrismaClient } from "../db/factory";
import { PrismaPglite } from "../db/pglite-adapter";
import {
	withCaptureJanitorDb,
	withCaptureRegisterDb,
	withDeviceDb,
	withUserDb,
} from "../db/rls";
import {
	AUTH_STUB,
	FORCE_RLS,
	GRANT_SEQUENCES,
	migrationSql,
	USER_A,
} from "./harness";

interface Queryable {
	exec: (sql: string) => Promise<unknown>;
	query: <T>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
}

const HOSTED_AUTH_OWNER = `
do $$ begin
  create role supabase_auth_admin nologin nosuperuser nobypassrls;
exception when duplicate_object then null;
end $$;
alter schema auth owner to supabase_auth_admin;
alter function auth.uid() owner to supabase_auth_admin;
revoke all on schema auth from public;
revoke all on function auth.uid() from public;
`;

const HOSTED_CAPTURE_PRIVILEGES = `
revoke usage on schema auth from device, capture_register, capture_janitor;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon, device, capture_register, capture_janitor;
`;

function tokenHash(): string {
	return createHash("sha256").update(randomBytes(32)).digest("hex");
}

describe("applyRlsContext capture identities", () => {
	it("does not call auth.uid() after dropping to device capture roles", () => {
		const source = readFileSync(
			new URL("../db/rls.ts", import.meta.url),
			"utf8"
		);
		const apply = source.slice(
			source.indexOf("export async function applyRlsContext"),
			source.indexOf("export function createRunWithDb")
		);
		const capture = apply.slice(apply.indexOf('case "device"'));
		expect(apply).toMatch(/auth\.uid\(\)/);
		expect(capture).not.toMatch(/auth\.uid\(/);
		expect(capture).not.toMatch(/SELECT auth\./);
		expect(capture).toMatch(/request\.jwt\.claim\.sub/);
		expect(capture).toMatch(/request\.jwt\.claims/);
	});
});

describe("hosted Supabase capture without auth schema USAGE", () => {
	let db: Queryable | null = null;
	let prisma: ReturnType<typeof createPrismaClient> | null = null;
	let skip = "PGlite not initialized";

	beforeAll(async () => {
		try {
			const { PGlite } = await import("@electric-sql/pglite");
			db = new PGlite();
			await db.exec(AUTH_STUB);
			await db.exec(HOSTED_AUTH_OWNER);
			await db.exec(migrationSql());
			await db.exec(FORCE_RLS);
			await db.exec(GRANT_SEQUENCES);
			await db.exec(HOSTED_CAPTURE_PRIVILEGES);
			await db.exec(`
        insert into auth.users (id, email) values ('${USER_A}', 'a@example.com');
        insert into public.profiles (id) values ('${USER_A}');
      `);
			prisma = createPrismaClient(new PrismaPglite(db as never));
		} catch (error) {
			db = null;
			prisma = null;
			skip = error instanceof Error ? error.message : String(error);
		}
	});

	it("matches hosted privileges: no auth USAGE for capture roles, EXECUTE on auth.uid() still true", async ({
		skip: skipTest,
	}) => {
		if (!db) {
			skipTest(skip);
			return;
		}
		const privileges = await db.query<{
			role: string;
			schema_usage: boolean;
			uid_execute: boolean;
		}>(
			`select r.rolname as role,
        has_schema_privilege(r.rolname, 'auth', 'USAGE') as schema_usage,
        has_function_privilege(r.rolname, 'auth.uid()', 'EXECUTE') as uid_execute
       from pg_roles r
       where r.rolname in ('authenticated', 'anon', 'device', 'capture_register', 'capture_janitor')
       order by 1`
		);
		const byRole = Object.fromEntries(
			privileges.rows.map((row) => [row.role, row])
		);
		expect(byRole.authenticated?.schema_usage).toBe(true);
		expect(byRole.anon?.schema_usage).toBe(true);
		expect(byRole.device?.schema_usage).toBe(false);
		expect(byRole.capture_register?.schema_usage).toBe(false);
		expect(byRole.capture_janitor?.schema_usage).toBe(false);
		expect(byRole.authenticated?.uid_execute).toBe(true);
		expect(byRole.anon?.uid_execute).toBe(true);
		expect(byRole.device?.uid_execute).toBe(true);
		expect(byRole.capture_register?.uid_execute).toBe(true);
		expect(byRole.capture_janitor?.uid_execute).toBe(true);

		await db.exec(`
      do $probe$
      begin
        set local role capture_register;
        perform auth.uid();
        raise exception 'expected permission denied for schema auth';
      exception
        when insufficient_privilege then null;
      end
      $probe$;
    `);
	});

	it("registers, ingests, claims, and sweeps without USAGE on schema auth", async ({
		skip: skipTest,
	}) => {
		if (!(db && prisma)) {
			skipTest(skip);
			return;
		}
		const device = await withCaptureRegisterDb(prisma, (tx) =>
			tx.device.create({
				data: {
					consent: {
						grantedAt: "2026-11-10T00:00:00.000Z",
						scopes: ["prompt_text"],
						version: 1,
					},
					tokenHash: tokenHash(),
				},
				select: { id: true },
			})
		);
		expect(device.id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
		);

		await withDeviceDb(prisma, device.id, (tx) =>
			ingestBatch(tx, device.id, {
				editor: "cursor",
				editorTaskId: "conv-hosted",
				events: [
					{
						generationId: "g1",
						idempotencyKey: `${device.id}:cursor:conv-hosted:prompt:g1`,
						kind: "prompt",
						occurredAt: "2026-11-10T12:00:00.000Z",
						text: "Fix the flaky test",
					},
				],
				workspaceHash: "abc",
			})
		);
		const pairing = await withUserDb(prisma, USER_A, (tx) =>
			startPairing(tx, USER_A)
		);
		const claimed = await withDeviceDb(prisma, device.id, (tx) =>
			claimDevice(tx, device.id, pairing.code)
		);
		expect(claimed.userId).toBe(USER_A);

		const stale = await withCaptureRegisterDb(prisma, (tx) =>
			tx.device.create({
				data: {
					consent: {
						grantedAt: "2026-08-01T00:00:00.000Z",
						scopes: ["prompt_text"],
						version: 1,
					},
					createdAt: new Date(Date.now() - UNCLAIMED_TTL_MS - 60_000),
					tokenHash: tokenHash(),
				},
				select: { id: true },
			})
		);
		await withDeviceDb(prisma, stale.id, (tx) =>
			ingestBatch(tx, stale.id, {
				editor: "cursor",
				editorTaskId: "stale-hosted",
				events: [
					{
						idempotencyKey: `${stale.id}:cursor:stale-hosted:prompt:g1`,
						kind: "prompt",
						occurredAt: "2026-08-01T12:00:00.000Z",
						text: "stale prompt",
					},
				],
				workspaceHash: "abc",
			})
		);
		const swept = await withCaptureJanitorDb(prisma, (tx) =>
			sweepUnclaimedDevices(tx)
		);
		expect(swept).toBeGreaterThanOrEqual(1);
		const leftover = await withCaptureRegisterDb(prisma, (tx) =>
			tx.device.findFirst({ select: { id: true }, where: { id: stale.id } })
		);
		expect(leftover).toBeNull();
		const kept = await withCaptureRegisterDb(prisma, (tx) =>
			tx.device.findFirst({ select: { id: true }, where: { id: device.id } })
		);
		expect(kept?.id).toBe(device.id);
	});
});
