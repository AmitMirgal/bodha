import { beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "../db/factory";
import { PrismaPglite } from "../db/pglite-adapter";
import { withUserDb } from "../db/rls";
import {
	AUTH_STUB,
	CREATE_ROLES,
	FORCE_RLS,
	GRANT_SEQUENCES,
	migrationSql,
	USER_A,
} from "../rls/harness";
import { loadHabitsView, loadLeaderboardView } from "./load";
import { readGamificationSchema } from "./schema";

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
      insert into auth.users (id, email) values ('${USER_A}', 'a@example.com');
      insert into public.profiles (id) values ('${USER_A}');
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
});

describe("loadLeaderboardView schema gaps", () => {
	it("records why the isolated Prisma path is unavailable when skipped", () => {
		if (!prisma) {
			expect.fail(`Prisma PGlite RLS harness unavailable: ${skip}`);
		}
		expect(prisma).toBeTruthy();
	});

	it("degrades when mati_leaderboard_week is missing (production 42883)", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		const before = await withUserDb(prisma, USER_A, (db) =>
			readGamificationSchema(db)
		);
		expect(before.functionReady).toBe(true);
		expect(before.tablesReady).toBe(true);
		await prisma.$executeRawUnsafe(
			"DROP FUNCTION IF EXISTS public.mati_leaderboard_week(date, integer)"
		);
		const after = await withUserDb(prisma, USER_A, (db) =>
			readGamificationSchema(db)
		);
		expect(after.functionReady).toBe(false);
		expect(after.tablesReady).toBe(true);
		const view = await withUserDb(prisma, USER_A, (db) =>
			loadLeaderboardView(db, USER_A, "UTC", "2026-11-13T18:00:00.000Z")
		);
		expect(view.migrationRequired).toBe(true);
		expect(view.rows).toEqual([]);
		await prisma.$executeRawUnsafe(
			"DROP TABLE IF EXISTS public.capture_report_opens, public.leaderboard_profiles, public.habit_awards CASCADE"
		);
		const withoutTables = await withUserDb(prisma, USER_A, (db) =>
			readGamificationSchema(db)
		);
		expect(withoutTables.tablesReady).toBe(false);
		const habits = await withUserDb(prisma, USER_A, (db) =>
			loadHabitsView(db, USER_A, "UTC")
		);
		expect(habits.migrationRequired).toBe(true);
		const board = await withUserDb(prisma, USER_A, (db) =>
			loadLeaderboardView(db, USER_A, "UTC", "2026-11-13T18:00:00.000Z")
		);
		expect(board.migrationRequired).toBe(true);
	});
});
