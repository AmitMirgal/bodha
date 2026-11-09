import { beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "../db/factory";
import { PrismaPglite } from "../db/pglite-adapter";
import { withUserDb } from "../db/rls";
import {
	AUTH_STUB,
	CREATE_ROLES,
	EVIDENCE_A,
	FORCE_RLS,
	GRANT_SEQUENCES,
	migrationSql,
	SESSION_A,
	SESSION_B,
	SNAP_A,
	USER_A,
	USER_B,
} from "../rls/harness";
import { loadProgressView } from "./load";

const SESSION_MISSING = "55555555-5555-4555-8555-555555555555";
const SNAP_B = "66666666-6666-4666-8666-666666666666";
const REPORT_A = "77777777-7777-4777-8777-777777777777";
const promptId = "11111111-1111-4111-8111-111111111111";

const reportBody = {
	summary: "The learner ran tests.",
	observations: {
		tests: {
			found: true,
			passed: 1,
			failed: 2,
			total: 3,
			fatal: null,
			provenance: "browser_harness",
		},
	},
	outcome: {
		observed:
			"Latest browser harness run observed 1 passing and 2 failing of 3 tests.",
		verification:
			"Results are browser-harness observations, not independent server execution.",
		verificationProvenance: "browser_harness",
	},
	suggestions: [
		{
			title: "Ask about the failing test",
			detail: "The prompt asked for a rewrite.",
			improvedExample: "Which test fails first?",
			whyItHelps: "It uses the recorded prompt.",
			citations: [{ evidenceId: promptId, kind: "prompt", note: "prompt" }],
			illustrative: false,
		},
	],
	usage: {
		trainer: {
			inputTokens: 12,
			outputTokens: 4,
			cachedTokens: 2,
			coverage: "complete",
		},
		review: {
			inputTokens: null,
			outputTokens: null,
			cachedTokens: null,
			coverage: "unknown",
		},
		incomplete: true,
	},
	insufficientEvidence: [],
};

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
		await db.exec(`
      insert into auth.users (id, email) values ('${USER_A}', 'a@example.com'), ('${USER_B}', 'b@example.com');
      insert into public.profiles (id) values ('${USER_A}'), ('${USER_B}');
    `);
		return createPrismaClient(new PrismaPglite(db));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		skip = message;
		return null;
	}
}

beforeAll(async () => {
	prisma = await tryPrismaPglite();
	if (!prisma) {
		return;
	}
	await withUserDb(prisma, USER_A, async (tx) => {
		await tx.session.create({
			data: {
				id: SESSION_A,
				userId: USER_A,
				exerciseId: "shelf",
				status: "complete",
				files: {},
				timezone: "UTC",
				startedAt: new Date("2026-11-08T12:01:00.000Z"),
				finishedAt: new Date("2026-11-08T12:10:00.000Z"),
			},
		});
		await tx.exerciseSnapshot.create({
			data: {
				id: SNAP_A,
				sessionId: SESSION_A,
				userId: USER_A,
				exerciseId: "shelf",
				contentHash: "sha256:x",
				specMarkdown: "spec",
				testsSource: "tests",
				starter: {},
				meta: {},
			},
		});
		await tx.evidenceEvent.create({
			data: {
				id: EVIDENCE_A,
				sessionId: SESSION_A,
				userId: USER_A,
				kind: "prompt",
				source: "learner",
				observationType: "trainer_prompt",
				payload: { content: "Which test fails first?" },
				idempotencyKey: "k1",
			},
		});
		await tx.message.create({
			data: {
				sessionId: SESSION_A,
				userId: USER_A,
				evidenceId: EVIDENCE_A,
				role: "user",
				content: "Which test fails first?",
			},
		});
		await tx.usageRecord.create({
			data: {
				sessionId: SESSION_A,
				userId: USER_A,
				operationId: "trainer-1",
				agentRole: "trainer",
				inputTokens: 12n,
				outputTokens: 4n,
				cachedTokens: 2n,
				cachedIncludedInInput: false,
				coverage: "complete",
			},
		});
		await tx.report.create({
			data: {
				id: REPORT_A,
				sessionId: SESSION_A,
				userId: USER_A,
				snapshotId: SNAP_A,
				version: 1,
				status: "complete",
				body: reportBody,
			},
		});
		await tx.session.create({
			data: {
				id: SESSION_MISSING,
				userId: USER_A,
				exerciseId: "cache",
				status: "running",
				files: {},
				timezone: "UTC",
				startedAt: new Date("2026-11-09T10:00:00.000Z"),
			},
		});
	});
	await withUserDb(prisma, USER_B, async (tx) => {
		await tx.session.create({
			data: {
				id: SESSION_B,
				userId: USER_B,
				exerciseId: "shelf",
				status: "complete",
				files: {},
				timezone: "UTC",
			},
		});
		await tx.exerciseSnapshot.create({
			data: {
				id: SNAP_B,
				sessionId: SESSION_B,
				userId: USER_B,
				exerciseId: "shelf",
				contentHash: "sha256:y",
				specMarkdown: "spec",
				testsSource: "tests",
				starter: {},
				meta: {},
			},
		});
		await tx.message.create({
			data: {
				sessionId: SESSION_B,
				userId: USER_B,
				role: "user",
				content: "secret to user B only",
			},
		});
	});
});

describe("loadProgressView", () => {
	it("records why the isolated Prisma path is unavailable when skipped", () => {
		if (!prisma) {
			expect.fail(`Prisma PGlite RLS harness unavailable: ${skip}`);
		}
		expect(prisma).toBeTruthy();
	});

	it("loads measured and missing trainer tasks for the owner only", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		const view = await withUserDb(prisma, USER_A, (db) =>
			loadProgressView(db, USER_A, "UTC")
		);
		expect(view.days.map((day) => day.date)).toEqual([
			"2026-11-09",
			"2026-11-08",
		]);
		const missing = view.days[0]?.tasks[0];
		const measured = view.days[1]?.tasks[0];
		expect(missing?.exerciseId).toBe("cache");
		expect(missing?.usage.label).toBe("missing");
		expect(measured?.usage).toMatchObject({
			label: "measured",
			inputTokens: 12,
			outputTokens: 4,
			cachedTokens: 2,
		});
		expect(measured?.prompts).toEqual(["Which test fails first?"]);
		expect(measured?.suggestions[0]?.improvedExample).toBe(
			"Which test fails first?"
		);
		const asB = await withUserDb(prisma, USER_B, (db) =>
			loadProgressView(db, USER_B, "UTC")
		);
		expect(
			asB.days.flatMap((day) => day.tasks).map((task) => task.sessionId)
		).toEqual([SESSION_B]);
		expect(
			asB.days.flatMap((day) => day.tasks).flatMap((task) => task.prompts)
		).toEqual(["secret to user B only"]);
		expect(
			view.days
				.flatMap((day) => day.tasks)
				.some((task) => task.sessionId === SESSION_B)
		).toBe(false);
	});
});
