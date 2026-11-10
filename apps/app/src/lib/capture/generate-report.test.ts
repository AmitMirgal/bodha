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
import { claimDeviceWithToken, startDeviceClaim } from "./device-claim";
import { generateCaptureTaskReport } from "./generate-report";
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

async function claimedTask() {
	if (!prisma) {
		throw new Error(skip);
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
			editorTaskId: `conv-${device.id.slice(0, 8)}`,
			events: [
				{
					generationId: "g1",
					idempotencyKey: `${device.id}:cursor:prompt:g1`,
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
	await withUserDb(prisma, USER_A, (db) =>
		claimDeviceWithToken(db, USER_A, started.token)
	);
	const task = await withUserDb(prisma, USER_A, (db) =>
		db.captureTask.findFirst({ where: { deviceId: device.id, userId: USER_A } })
	);
	if (!task) {
		throw new Error("expected a claimed task");
	}
	return { taskId: task.id };
}

beforeAll(async () => {
	prisma = await tryPrismaPglite();
});

describe("generateCaptureTaskReport", () => {
	it("stores a facts-only report when no key is configured", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		const { taskId } = await claimedTask();
		const generated = await withUserDb(prisma, USER_A, (db) =>
			generateCaptureTaskReport(db, USER_A, taskId, {
				deps: {
					resolveLlm: () => {
						const error = new Error(
							"Add a provider API key in Settings before generating a coached report."
						);
						error.name = "LlmConfigError";
						return Promise.reject(error);
					},
				},
			})
		);
		expect(generated.status).toBe("complete");
		expect(generated.kind).toBe("facts_only");
		expect(generated.body).toMatchObject({
			kind: "facts_only",
			suggestions: [],
		});
		const asB = await withUserDb(prisma, USER_B, (db) =>
			db.captureReport.findMany()
		);
		expect(asB).toEqual([]);
	});

	it("stores mocked coaching and redacts provider failures", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		const first = await claimedTask();
		const events = await withUserDb(prisma, USER_A, (db) =>
			db.captureEvent.findMany({ where: { taskId: first.taskId } })
		);
		const prompt = events.find((event) => event.kind === "prompt");
		if (!prompt) {
			throw new Error("expected a prompt event");
		}
		const coached = await withUserDb(prisma, USER_A, (db) =>
			generateCaptureTaskReport(db, USER_A, first.taskId, {
				deps: {
					resolveLlm: () => Promise.resolve({ ok: true }),
					review: () =>
						Promise.resolve({
							insufficientEvidence: [],
							suggestions: [
								{
									citations: [
										{
											evidenceId: prompt.id,
											kind: "prompt",
											note: "stored prompt",
										},
									],
									detail: "The stored prompt asked for a rewrite.",
									illustrative: false,
									improvedExample:
										"Which test is flaky, and what assertion fails?",
									title: "Name the failing test",
									whyItHelps: "It uses the recorded prompt.",
								},
							],
							summary: "Name the failing test in the prompt.",
						}),
				},
			})
		);
		expect(coached.status).toBe("complete");
		expect(coached.kind).toBe("coached");
		expect(JSON.stringify(coached.body)).toContain("Name the failing test");
		expect(JSON.stringify(coached.body)).not.toMatch(/sk-|api[_-]?key/i);

		const second = await claimedTask();
		const failed = await withUserDb(prisma, USER_A, (db) =>
			generateCaptureTaskReport(db, USER_A, second.taskId, {
				deps: {
					resolveLlm: () => Promise.resolve({ ok: true }),
					review: () =>
						Promise.reject(
							new Error("provider 401 Authorization: Bearer sk-live-secret")
						),
				},
				force: true,
			})
		);
		expect(failed.status).toBe("failed");
		expect(failed.error).not.toMatch(/sk-live-secret/i);
		expect(failed.error).not.toMatch(/Bearer/i);
	});
});
