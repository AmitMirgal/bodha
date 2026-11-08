import { beforeAll, describe, expect, it } from "vitest";
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
import { createPrismaClient } from "./factory";
import { PrismaPglite } from "./pglite-adapter";
import { insertEvidenceOnce, listSessions } from "./queries";
import { RlsContextError, withAnonDb, withUserDb } from "./rls";

const livePrisma =
	process.env.BODHA_LIVE_PRISMA_RLS === "1" &&
	Boolean(process.env.DATABASE_URL);

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
		const client = createPrismaClient(new PrismaPglite(db));
		await withUserDb(client, USER_A, async (tx) => {
			await tx.session.create({
				data: {
					id: SESSION_A,
					userId: USER_A,
					exerciseId: "shelf",
					status: "running",
					files: {},
					timezone: "UTC",
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
					payload: { content: "hi" },
					idempotencyKey: "k1",
				},
			});
		});
		return client;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const nested =
			error && typeof error === "object" && "cause" in error
				? String((error as { cause?: unknown }).cause)
				: "";
		skip = nested ? `${message} (${nested})` : message;
		return null;
	}
}

beforeAll(async () => {
	prisma = await tryPrismaPglite();
});

describe("Prisma request-path RLS (PGlite)", () => {
	it("records why the isolated Prisma path is unavailable when skipped", () => {
		if (!prisma) {
			expect.fail(`Prisma PGlite RLS harness unavailable: ${skip}`);
		}
		expect(prisma).toBeTruthy();
	});

	it("verifies SET LOCAL ROLE dropped the privileged login before queries", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		await withUserDb(prisma, USER_A, async (db) => {
			const rows = await db.$queryRaw<
				Array<{ role_name: string; super: string; uid: string | null }>
			>`SELECT current_user::text AS role_name, current_setting('is_superuser') AS super, auth.uid()::text AS uid`;
			expect(rows[0]?.role_name).toBe("authenticated");
			expect(rows[0]?.super).toBe("off");
			expect(rows[0]?.uid).toBe(USER_A);
		});
	});

	it("hides user A's session from user B and from anon on the Prisma path", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		const owned = await withUserDb(prisma, USER_A, (db) =>
			listSessions(db, USER_A)
		);
		expect(owned.some((row) => row.id === SESSION_A)).toBe(true);
		const other = await withUserDb(prisma, USER_B, (db) =>
			db.session.findMany({ where: { id: SESSION_A } })
		);
		expect(other).toEqual([]);
		await expect(
			withAnonDb(prisma, (db) => db.session.findMany())
		).rejects.toThrow();
	});

	it("rejects forged owner inserts through the same Prisma request wrapper", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		await expect(
			withUserDb(prisma, USER_B, (db) =>
				db.session.create({
					data: {
						id: SESSION_B,
						userId: USER_A,
						exerciseId: "cache",
						status: "running",
					},
				})
			)
		).rejects.toThrow();
		await withUserDb(prisma, USER_B, async (db) => {
			await db.session.create({
				data: {
					id: SESSION_B,
					userId: USER_B,
					exerciseId: "cache",
					status: "running",
				},
			});
		});
		await expect(
			withUserDb(prisma, USER_B, (db) =>
				db.exerciseSnapshot.create({
					data: {
						sessionId: SESSION_A,
						userId: USER_B,
						exerciseId: "cache",
						contentHash: "sha256:y",
						specMarkdown: "spec",
						testsSource: "tests",
						starter: {},
						meta: {},
					},
				})
			)
		).rejects.toThrow();
		await expect(
			withUserDb(prisma, USER_B, (db) =>
				db.message.create({
					data: {
						sessionId: SESSION_B,
						userId: USER_B,
						evidenceId: EVIDENCE_A,
						role: "user",
						content: "forged",
					},
				})
			)
		).rejects.toThrow();
	});

	it("keeps first-write-wins evidence inserts and refuses privileged bypass", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		const second = await withUserDb(prisma, USER_A, (db) =>
			insertEvidenceOnce(db, {
				sessionId: SESSION_A,
				userId: USER_A,
				kind: "prompt",
				source: "learner",
				observationType: "trainer_prompt",
				payload: { content: "second" },
				idempotencyKey: "k1",
			})
		);
		expect(second.created).toBe(false);
		const payload = await withUserDb(prisma, USER_A, (db) =>
			db.evidenceEvent.findFirst({
				where: { sessionId: SESSION_A, idempotencyKey: "k1" },
			})
		);
		expect(payload?.payload).toEqual({ content: "hi" });
		await expect(
			prisma.$transaction(async (tx) => {
				const rows = await tx.$queryRaw<Array<{ role_name: string }>>`
          SELECT current_user::text AS role_name
        `;
				if (
					rows[0]?.role_name === "postgres" ||
					rows[0]?.role_name === "pglite"
				) {
					throw new RlsContextError(
						"Raw Prisma client remains the privileged login; product queries must use withUserDb."
					);
				}
			})
		).rejects.toBeInstanceOf(RlsContextError);
	});
});

describe("live Prisma RLS", () => {
	it("is blocked unless BODHA_LIVE_PRISMA_RLS=1 is set on an isolated project", () => {
		expect(livePrisma).toBe(false);
	});
});
