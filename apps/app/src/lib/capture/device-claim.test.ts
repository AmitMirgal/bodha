import { createHash, randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "../db/factory";
import { PrismaPglite } from "../db/pglite-adapter";
import { withCaptureRegisterDb, withDeviceDb, withUserDb } from "../db/rls";
import {
	AUTH_STUB,
	CREATE_ROLES,
	FORCE_RLS,
	GRANT_SEQUENCES,
	migrationSql,
	USER_A,
	USER_B,
} from "../rls/harness";
import {
	claimDeviceWithToken,
	DEVICE_CLAIM_TTL_MS,
	generateDeviceClaimToken,
	hashDeviceClaimToken,
	requestSameOrigin,
	startDeviceClaim,
} from "./device-claim";
import { ingestBatch } from "./ingest";

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

describe("device claim tokens", () => {
	it("hashes the raw token and never stores it", () => {
		const token = generateDeviceClaimToken();
		expect(token).toMatch(/^[0-9a-f]{64}$/);
		expect(hashDeviceClaimToken(token)).toHaveLength(64);
		expect(hashDeviceClaimToken(token)).not.toBe(token);
	});

	it("rejects cross-origin POSTs and allows same-origin or missing Origin", () => {
		expect(
			requestSameOrigin(
				new Request("https://mati.example/api/capture/v1/account/claim", {
					headers: { origin: "https://evil.example" },
					method: "POST",
				})
			)
		).toBe(false);
		expect(
			requestSameOrigin(
				new Request("https://mati.example/api/capture/v1/account/claim", {
					headers: { origin: "https://mati.example" },
					method: "POST",
				})
			)
		).toBe(true);
		expect(
			requestSameOrigin(
				new Request("https://mati.example/api/capture/v1/account/claim", {
					method: "POST",
				})
			)
		).toBe(true);
	});

	it("lets the signed-in owner consume a one-time token and hides rows from another user", async ({
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
						grantedAt: "2026-11-10T00:00:00.000Z",
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
				editorTaskId: "conv-web-claim",
				events: [
					{
						generationId: "g1",
						idempotencyKey: `${device.id}:cursor:conv-web-claim:prompt:g1`,
						kind: "prompt",
						occurredAt: "2026-11-10T12:00:00.000Z",
						text: "Fix the flaky test",
					},
				],
				workspaceHash: "abc",
			})
		);
		const started = await withDeviceDb(prisma, device.id, (db) =>
			startDeviceClaim(db, device.id)
		);
		expect(started.token).toMatch(/^[0-9a-f]{64}$/);
		const stored = await withDeviceDb(prisma, device.id, (db) =>
			db.deviceClaimToken.findMany({ where: { deviceId: device.id } })
		);
		expect(stored).toHaveLength(1);
		expect(stored[0]?.tokenHash).toBe(hashDeviceClaimToken(started.token));
		expect(stored[0]?.tokenHash).not.toBe(started.token);
		const claimed = await withUserDb(prisma, USER_A, (db) =>
			claimDeviceWithToken(db, USER_A, started.token)
		);
		expect(claimed.deviceId).toBe(device.id);
		const replay = await withUserDb(prisma, USER_A, (db) =>
			claimDeviceWithToken(db, USER_A, started.token)
		);
		expect(replay.deviceId).toBe(device.id);
		await expect(
			withUserDb(prisma, USER_B, (db) =>
				claimDeviceWithToken(db, USER_B, started.token)
			)
		).rejects.toThrow(/invalid, expired, or already used/);
		const asA = await withUserDb(prisma, USER_A, (db) =>
			db.captureTask.findMany()
		);
		expect(asA).toHaveLength(1);
		expect(asA[0]?.editorTaskId).toBe("conv-web-claim");
		const asB = await withUserDb(prisma, USER_B, (db) =>
			db.captureTask.findMany()
		);
		expect(asB).toEqual([]);
		const reportsB = await withUserDb(prisma, USER_B, (db) =>
			db.captureReport.findMany()
		);
		expect(reportsB).toEqual([]);
	});

	it("rejects an expired claim token", async ({ skip: skipTest }) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		const device = await withCaptureRegisterDb(prisma, (db) =>
			db.device.create({
				data: {
					consent: {
						grantedAt: "2026-11-10T00:00:00.000Z",
						scopes: ["prompt_text"],
						version: 1,
					},
					tokenHash: tokenHash(),
				},
			})
		);
		const started = await withDeviceDb(prisma, device.id, (db) =>
			startDeviceClaim(
				db,
				device.id,
				new Date(Date.now() - DEVICE_CLAIM_TTL_MS - 1000)
			)
		);
		await expect(
			withUserDb(prisma, USER_A, (db) =>
				claimDeviceWithToken(db, USER_A, started.token)
			)
		).rejects.toThrow(/invalid, expired, or already used/);
	});
});
