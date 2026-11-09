import { createHash, randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "../db/factory";
import { PrismaPglite } from "../db/pglite-adapter";
import {
	withAnonDb,
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
} from "../rls/harness";
import { ingestBatch, listDeviceTasks } from "./ingest";

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
      insert into auth.users (id, email) values ('${USER_A}', 'a@example.com');
      insert into public.profiles (id) values ('${USER_A}');
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

describe("capture ingest RLS", () => {
	it("records why the isolated Prisma path is unavailable when skipped", () => {
		if (!prisma) {
			expect.fail(`Prisma PGlite RLS harness unavailable: ${skip}`);
		}
		expect(prisma).toBeTruthy();
	});

	it("isolates unclaimed events per device and retries are idempotent", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		const deviceA = await withCaptureRegisterDb(prisma, (db) =>
			db.device.create({
				data: {
					tokenHash: tokenHash(),
					consent: {
						version: 1,
						grantedAt: "2026-11-09T00:00:00.000Z",
						scopes: ["prompt_text"],
					},
				},
			})
		);
		const deviceB = await withCaptureRegisterDb(prisma, (db) =>
			db.device.create({
				data: {
					tokenHash: tokenHash(),
					consent: {
						version: 1,
						grantedAt: "2026-11-09T00:00:00.000Z",
						scopes: ["prompt_text"],
					},
				},
			})
		);
		const batch = {
			editor: "cursor" as const,
			editorTaskId: "conv-1",
			workspaceHash: "abc",
			events: [
				{
					idempotencyKey: `${deviceA.id}:cursor:conv-1:prompt:g1`,
					kind: "prompt" as const,
					occurredAt: "2026-11-09T12:00:00.000Z",
					text: "Fix the flaky test",
					generationId: "g1",
				},
			],
		};
		const first = await withDeviceDb(prisma, deviceA.id, (db) =>
			ingestBatch(db, deviceA.id, batch)
		);
		const second = await withDeviceDb(prisma, deviceA.id, (db) =>
			ingestBatch(db, deviceA.id, batch)
		);
		expect(first.accepted).toBe(1);
		expect(second.accepted).toBe(0);
		const asA = await withDeviceDb(prisma, deviceA.id, (db) =>
			listDeviceTasks(db, deviceA.id)
		);
		expect(asA[0]?.prompts).toEqual(["Fix the flaky test"]);
		const asB = await withDeviceDb(prisma, deviceB.id, (db) =>
			listDeviceTasks(db, deviceB.id)
		);
		expect(asB).toEqual([]);
		const asUser = await withUserDb(prisma, USER_A, (db) =>
			db.captureTask.findMany()
		);
		expect(asUser).toEqual([]);
		await expect(
			withAnonDb(prisma, (db) => db.captureTask.findMany())
		).rejects.toThrow();
		const asBEvents = await withDeviceDb(prisma, deviceB.id, (db) =>
			db.captureEvent.findMany()
		);
		expect(asBEvents).toEqual([]);
	});

	it("stores measured Copilot OTel usage and rejects text_estimate as measured", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		const device = await withCaptureRegisterDb(prisma, (db) =>
			db.device.create({
				data: {
					tokenHash: tokenHash(),
					consent: {
						version: 1,
						grantedAt: "2026-11-09T00:00:00.000Z",
						scopes: ["usage"],
					},
				},
			})
		);
		const accepted = await withDeviceDb(prisma, device.id, (db) =>
			ingestBatch(db, device.id, {
				editor: "vscode",
				editorTaskId: "sess-1",
				workspaceHash: "abc",
				events: [
					{
						idempotencyKey: `${device.id}:vscode:sess-1:usage:otel:span-1`,
						kind: "usage",
						occurredAt: "2026-11-09T12:00:01.000Z",
						operationId: "otel:span-1",
						inputTokens: 12,
						outputTokens: 4,
						cachedTokens: 3,
						reasoningTokens: 3,
						model: "gpt-4.1",
						provenance: "measured",
						source: "copilot_otel_chat_span",
					},
				],
			})
		);
		expect(accepted.accepted).toBe(1);
		const tasks = await withDeviceDb(prisma, device.id, (db) =>
			listDeviceTasks(db, device.id)
		);
		expect(tasks[0]?.usage[0]).toMatchObject({
			inputTokens: 12,
			outputTokens: 4,
			cachedTokens: 3,
			reasoningTokens: 3,
			provenance: "measured",
			source: "copilot_otel_chat_span",
		});
		await expect(
			withDeviceDb(prisma, device.id, (db) =>
				ingestBatch(db, device.id, {
					editor: "vscode",
					editorTaskId: "sess-1",
					workspaceHash: "abc",
					events: [
						{
							idempotencyKey: `${device.id}:vscode:sess-1:usage:bad`,
							kind: "usage",
							occurredAt: "2026-11-09T12:00:02.000Z",
							operationId: "bad",
							inputTokens: 1,
							provenance: "measured",
							source: "text_estimate",
						},
					],
				})
			)
		).rejects.toThrow("text_estimate cannot be stored as measured");
	});
});
