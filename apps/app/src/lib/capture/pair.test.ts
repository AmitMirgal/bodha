import { createHash, randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "../db/factory";
import { PrismaPglite } from "../db/pglite-adapter";
import {
	withAnonDb,
	withCaptureJanitorDb,
	withCaptureRegisterDb,
	withDeviceDb,
	withUserDb,
} from "../db/rls";
import {
	AUTH_STUB,
	CREATE_ROLES,
	FORCE_RLS,
	GRANT_SEQUENCES,
	migrationSql,
	USER_A,
	USER_B,
} from "../rls/harness";
import { ingestBatch } from "./ingest";
import {
	claimDevice,
	deleteClaimedDevice,
	deleteOwnDevice,
	startPairing,
	sweepUnclaimedDevices,
	UNCLAIMED_TTL_MS,
} from "./pair";

let prisma: ReturnType<typeof createPrismaClient> | null = null;
let skip = "PGlite Prisma adapter not initialized";

function tokenHash(): string {
	return createHash("sha256").update(randomBytes(32)).digest("hex");
}

async function tryPrismaPglite() {
	try {
		const { PGlite } = await import("@electric-sql/pglite");
		const db = new PGlite();
		await db.exec(AUTH_STUB);
		await db.exec(CREATE_ROLES);
		await db.exec(migrationSql());
		await db.exec(FORCE_RLS);
		await db.exec(GRANT_SEQUENCES);
		await db.exec(`
      insert into auth.users (id, email) values ('${USER_A}', 'a@example.com'), ('${USER_B}', 'b@example.com');
      insert into public.profiles (id) values ('${USER_A}'), ('${USER_B}');
    `);
		return createPrismaClient(new PrismaPglite(db));
	} catch (error) {
		skip = error instanceof Error ? error.message : String(error);
		return null;
	}
}

beforeAll(async () => {
	prisma = await tryPrismaPglite();
});

describe("capture claim, deletion, and TTL", () => {
	it("records why the isolated Prisma path is unavailable when skipped", () => {
		if (!prisma) {
			expect.fail(`Prisma PGlite RLS harness unavailable: ${skip}`);
		}
		expect(prisma).toBeTruthy();
	});

	it("lets device A claim into user A, hides rows from user B, and wipes on delete", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		const device = await withCaptureRegisterDb(prisma, (db) =>
			db.device.create({
				data: {
					consent: {
						grantedAt: "2026-11-09T00:00:00.000Z",
						scopes: ["prompt_text"],
						version: 1,
					},
					tokenHash: tokenHash(),
				},
			})
		);
		await withDeviceDb(prisma, device.id, (db) =>
			ingestBatch(db, device.id, {
				editor: "cursor",
				editorTaskId: "conv-claim",
				events: [
					{
						generationId: "g1",
						idempotencyKey: `${device.id}:cursor:conv-claim:prompt:g1`,
						kind: "prompt",
						occurredAt: "2026-11-09T12:00:00.000Z",
						text: "Fix the flaky test",
					},
				],
				workspaceHash: "abc",
			})
		);
		const pairing = await withUserDb(prisma, USER_A, (db) =>
			startPairing(db, USER_A)
		);
		const claimed = await withDeviceDb(prisma, device.id, (db) =>
			claimDevice(db, device.id, pairing.code)
		);
		expect(claimed.userId).toBe(USER_A);
		const asA = await withUserDb(prisma, USER_A, (db) =>
			db.captureTask.findMany()
		);
		expect(asA).toHaveLength(1);
		expect(asA[0]?.editorTaskId).toBe("conv-claim");
		const asB = await withUserDb(prisma, USER_B, (db) =>
			db.captureTask.findMany()
		);
		expect(asB).toEqual([]);
		await expect(
			withAnonDb(prisma, (db) => db.captureTask.findMany())
		).rejects.toThrow();
		const deleted = await withUserDb(prisma, USER_A, (db) =>
			deleteClaimedDevice(db, USER_A, device.id)
		);
		expect(deleted).toBe(true);
		const after = await withUserDb(prisma, USER_A, (db) =>
			db.captureTask.findMany()
		);
		expect(after).toEqual([]);
	});

	it("device delete cascades this device only and sweep drops 90-day unclaimed rows", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		const keep = await withCaptureRegisterDb(prisma, (db) =>
			db.device.create({
				data: {
					consent: {
						grantedAt: "2026-11-09T00:00:00.000Z",
						scopes: ["prompt_text"],
						version: 1,
					},
					tokenHash: tokenHash(),
				},
			})
		);
		const stale = await withCaptureRegisterDb(prisma, (db) =>
			db.device.create({
				data: {
					consent: {
						grantedAt: "2026-08-01T00:00:00.000Z",
						scopes: ["prompt_text"],
						version: 1,
					},
					createdAt: new Date(Date.now() - UNCLAIMED_TTL_MS - 60_000),
					tokenHash: tokenHash(),
				},
			})
		);
		await withDeviceDb(prisma, keep.id, (db) =>
			ingestBatch(db, keep.id, {
				editor: "cursor",
				editorTaskId: "keep",
				events: [
					{
						idempotencyKey: `${keep.id}:cursor:keep:prompt:g1`,
						kind: "prompt",
						occurredAt: "2026-11-09T12:00:00.000Z",
						text: "keep me",
					},
				],
				workspaceHash: "abc",
			})
		);
		await withDeviceDb(prisma, stale.id, (db) =>
			ingestBatch(db, stale.id, {
				editor: "cursor",
				editorTaskId: "stale",
				events: [
					{
						idempotencyKey: `${stale.id}:cursor:stale:prompt:g1`,
						kind: "prompt",
						occurredAt: "2026-08-01T12:00:00.000Z",
						text: "stale prompt",
					},
				],
				workspaceHash: "abc",
			})
		);
		await withDeviceDb(prisma, keep.id, (db) => deleteOwnDevice(db, keep.id));
		const gone = await withCaptureRegisterDb(prisma, (db) =>
			db.device.findFirst({ where: { id: keep.id } })
		);
		expect(gone).toBeNull();
		const swept = await withCaptureJanitorDb(prisma, (db) =>
			sweepUnclaimedDevices(db)
		);
		expect(swept).toBeGreaterThanOrEqual(1);
		const leftover = await withCaptureRegisterDb(prisma, (db) =>
			db.device.findFirst({ where: { id: stale.id } })
		);
		expect(leftover).toBeNull();
	});
});
