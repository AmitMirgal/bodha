import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "../db/factory";
import { PrismaPglite } from "../db/pglite-adapter";
import { withCaptureRegisterDb, withDeviceDb } from "../db/rls";
import {
	AUTH_STUB,
	CREATE_ROLES,
	FORCE_RLS,
	GRANT_SEQUENCES,
	migrationSql,
} from "../rls/harness";
import { ingestBatch, listDeviceTasks } from "./ingest";
import { ingestBatchFromCursorHook } from "./map-cursor";

const HOOK = fileURLToPath(
	new URL("../../../../../extensions/mati/hooks/cursor.mjs", import.meta.url)
);

let prisma: ReturnType<typeof createPrismaClient> | null = null;
let skip = "PGlite Prisma adapter not initialized";

async function tryPrismaPglite() {
	try {
		const { PGlite } = await import("@electric-sql/pglite");
		const db = new PGlite();
		await db.exec(AUTH_STUB);
		await db.exec(CREATE_ROLES);
		await db.exec(migrationSql());
		await db.exec(FORCE_RLS);
		await db.exec(GRANT_SEQUENCES);
		return createPrismaClient(new PrismaPglite(db));
	} catch (error) {
		skip = error instanceof Error ? error.message : String(error);
		return null;
	}
}

beforeAll(async () => {
	prisma = await tryPrismaPglite();
});

describe("Cursor hook command to ingest", () => {
	it("appends a documented beforeSubmitPrompt payload and stores the prompt", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		const queueDir = mkdtempSync(path.join(tmpdir(), "mati-queue-"));
		const matiHome = mkdtempSync(path.join(tmpdir(), "mati-home-"));
		writeFileSync(
			path.join(matiHome, "capture-gate.json"),
			JSON.stringify({ capturing: true, deviceId: "testdevice" })
		);
		const payload = {
			conversation_id: "conv-hook-1",
			generation_id: "gen-hook-1",
			hook_event_name: "beforeSubmitPrompt",
			prompt: "Fix the flaky test in checkout",
			user_email: "secret@example.com",
			timestamp: "2026-11-09T12:00:00.000Z",
		};
		execFileSync("node", [HOOK], {
			input: JSON.stringify(payload),
			env: {
				...process.env,
				MATI_HOME: matiHome,
				MATI_QUEUE_DIR: queueDir,
				MATI_DEVICE_ID: "testdevice",
			},
			encoding: "utf8",
		});
		const line = readFileSync(path.join(queueDir, "testdevice.jsonl"), "utf8")
			.trim()
			.split("\n")[0];
		expect(line).toBeDefined();
		const raw = JSON.parse(line ?? "{}");
		expect(raw.user_email).toBeUndefined();
		const batch = ingestBatchFromCursorHook(raw, "workspace-hash-test");
		expect(batch?.events[0]?.text).toBe("Fix the flaky test in checkout");
		if (!batch) {
			throw new Error("hook payload did not map to an ingest batch");
		}
		const device = await withCaptureRegisterDb(prisma, (db) =>
			db.device.create({
				data: {
					tokenHash: "a".repeat(64),
					consent: {
						version: 1,
						grantedAt: "2026-11-09T00:00:00.000Z",
						scopes: ["prompt_text"],
					},
				},
			})
		);
		await withDeviceDb(prisma, device.id, (db) =>
			ingestBatch(db, device.id, batch)
		);
		const tasks = await withDeviceDb(prisma, device.id, (db) =>
			listDeviceTasks(db, device.id)
		);
		expect(tasks[0]?.prompts).toEqual(["Fix the flaky test in checkout"]);
		expect(tasks[0]?.usage[0]?.provenance).toBe("missing");
		expect(tasks[0]?.usage[0]?.inputTokens).toBeNull();
	});
});
