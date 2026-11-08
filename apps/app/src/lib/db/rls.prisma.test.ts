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
import { inspectLivePrismaTarget } from "./live-target";
import { PrismaPglite } from "./pglite-adapter";
import { insertEvidenceOnce, listSessions } from "./queries";
import { RlsContextError, withAnonDb, withUserDb } from "./rls";

const liveTarget = inspectLivePrismaTarget(process.env);

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

	it("keeps first-write-wins evidence inserts", async ({ skip: skipTest }) => {
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
	});

	it("leaves a raw Prisma transaction on the privileged login role", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		const rows = await prisma.$transaction(
			async (tx) =>
				tx.$queryRaw<
					Array<{ bypass: unknown; role_name: string; super: unknown }>
				>`SELECT current_user::text AS role_name,
        r.rolsuper AS super,
        r.rolbypassrls AS bypass
        FROM pg_roles r
        WHERE r.rolname = current_user`
		);
		expect(rows[0]?.role_name).not.toBe("authenticated");
		expect(rows[0]?.role_name).not.toBe("anon");
		expect(rows[0]?.role_name).toBe("postgres");
		expect(rows[0]?.super === true || rows[0]?.bypass === true).toBe(true);
	});

	it("fails closed when authenticated is a non-superuser BYPASSRLS role", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		await prisma.$executeRawUnsafe("ALTER ROLE authenticated BYPASSRLS");
		try {
			const flags = await prisma.$queryRaw<
				Array<{ rolbypassrls: unknown; rolsuper: unknown }>
			>`SELECT r.rolsuper, r.rolbypassrls
        FROM pg_roles r
        WHERE r.rolname = 'authenticated'`;
			expect(flags[0]?.rolsuper).toBe(false);
			expect(flags[0]?.rolbypassrls).toBe(true);
			await expect(
				withUserDb(prisma, USER_A, (db) => db.session.findMany())
			).rejects.toBeInstanceOf(RlsContextError);
			const claims = JSON.stringify({ sub: USER_B, role: "authenticated" });
			const leaked = await prisma.$transaction(async (tx) => {
				await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${claims}, true)`;
				await tx.$executeRaw`SELECT set_config('request.jwt.claim.sub', ${USER_B}, true)`;
				await tx.$executeRawUnsafe("SET LOCAL ROLE authenticated");
				return tx.session.findMany({ where: { id: SESSION_A } });
			});
			expect(leaked.some((row) => row.id === SESSION_A)).toBe(true);
		} finally {
			await prisma.$executeRawUnsafe("ALTER ROLE authenticated NOBYPASSRLS");
		}
		const restored = await withUserDb(prisma, USER_B, (db) =>
			db.session.findMany({ where: { id: SESSION_A } })
		);
		expect(restored).toEqual([]);
	});
});

describe("opt-in live PrismaPg RLS (Supabase transaction pooler)", () => {
	it("records that the live PrismaPg suite was not executed without an isolated target", () => {
		switch (liveTarget.kind) {
			case "skipped":
				expect(liveTarget.reason).toMatch(/was not executed/);
				return;
			case "refused":
				expect.fail(liveTarget.reason);
				return;
			case "ready":
				expect(liveTarget.connectionString).toContain(":6543");
				return;
			default: {
				const exhaustive: never = liveTarget;
				throw new Error(`Unhandled live target: ${JSON.stringify(exhaustive)}`);
			}
		}
	});

	it("runs owner, cross-user, anon, and pooled GUC leakage checks on PrismaPg", async ({
		skip: skipTest,
	}) => {
		if (liveTarget.kind !== "ready") {
			skipTest(liveTarget.reason);
			return;
		}
		const { PrismaPg } = await import("@prisma/adapter-pg");
		const client = createPrismaClient(
			new PrismaPg({ connectionString: liveTarget.connectionString })
		);
		try {
			const marker = `live-prisma-${crypto.randomUUID()}`;
			const created = await withUserDb(client, liveTarget.userAId, (db) =>
				db.session.create({
					data: {
						userId: liveTarget.userAId,
						exerciseId: marker,
						status: "running",
						files: {},
						timezone: "UTC",
					},
					select: { id: true },
				})
			);
			const owned = await withUserDb(client, liveTarget.userAId, (db) =>
				db.session.findMany({
					where: { id: created.id, exerciseId: marker },
				})
			);
			expect(owned.some((row) => row.id === created.id)).toBe(true);
			const other = await withUserDb(client, liveTarget.userBId, (db) =>
				db.session.findMany({ where: { id: created.id } })
			);
			expect(other).toEqual([]);
			await expect(
				withAnonDb(client, (db) => db.session.findMany())
			).rejects.toThrow();
			const leftover = await client.$transaction(
				async (tx) =>
					tx.$queryRaw<Array<{ role_name: string; sub: string | null }>>`
          SELECT current_user::text AS role_name,
            current_setting('request.jwt.claim.sub', true) AS sub
        `
			);
			expect(leftover[0]?.role_name).not.toBe("authenticated");
			expect(leftover[0]?.role_name).not.toBe("anon");
			expect(leftover[0]?.sub ?? "").toBe("");
			await withUserDb(client, liveTarget.userBId, async (db) => {
				const identity = await db.$queryRaw<
					Array<{ role_name: string; uid: string | null }>
				>`SELECT current_user::text AS role_name, auth.uid()::text AS uid`;
				expect(identity[0]?.role_name).toBe("authenticated");
				expect(identity[0]?.uid).toBe(liveTarget.userBId);
			});
		} finally {
			await client.$disconnect();
		}
	});
});
