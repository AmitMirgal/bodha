import { beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "../db/factory";
import { PrismaPglite } from "../db/pglite-adapter";
import { withDeviceDb, withUserDb } from "../db/rls";
import {
	AUTH_STUB,
	CREATE_ROLES,
	FORCE_RLS,
	GRANT_SEQUENCES,
	migrationSql,
	USER_A,
	USER_B,
} from "../rls/harness";

const DEVICE_A = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

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
});

describe("gamification RLS", () => {
	it("records why the isolated Prisma path is unavailable when skipped", () => {
		if (!prisma) {
			expect.fail(`Prisma PGlite RLS harness unavailable: ${skip}`);
		}
		expect(prisma).toBeTruthy();
	});

	it("hides another user's awards and drops opted-out names from the board", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		await withUserDb(prisma, USER_A, async (db) => {
			await db.leaderboardProfile.create({
				data: {
					displayName: "Ada",
					optedIn: true,
					userId: USER_A,
				},
			});
			await db.habitAward.create({
				data: {
					awardKey: "badge:first_close",
					badgeId: "first_close",
					dayBucket: new Date("2026-11-10T00:00:00.000Z"),
					earnedAt: new Date("2026-11-10T12:00:00.000Z"),
					kind: "badge",
					points: 20,
					userId: USER_A,
					weekStart: new Date("2026-11-09T00:00:00.000Z"),
				},
			});
		});
		await withUserDb(prisma, USER_B, async (db) => {
			await db.leaderboardProfile.create({
				data: {
					displayName: "Bea",
					optedIn: true,
					userId: USER_B,
				},
			});
			const hidden = await db.habitAward.findMany();
			expect(hidden).toEqual([]);
			const profiles = await db.leaderboardProfile.findMany();
			expect(profiles).toHaveLength(1);
			expect(profiles[0]?.displayName).toBe("Bea");
			const board = await db.$queryRaw<
				Array<{ display_name: string; is_self: boolean; points: number }>
			>`SELECT display_name, is_self, points FROM public.mati_leaderboard_week('2026-11-09'::date, 20)`;
			expect(board.some((row) => row.display_name === "Ada")).toBe(true);
			expect(board.some((row) => row.display_name === "Bea")).toBe(true);
			expect(board.find((row) => row.display_name === "Bea")?.is_self).toBe(
				true
			);
			await db.leaderboardProfile.update({
				data: { optedIn: false },
				where: { userId: USER_B },
			});
			const after = await db.$queryRaw<Array<{ display_name: string }>>`
        SELECT display_name FROM public.mati_leaderboard_week('2026-11-09'::date, 20)`;
			expect(after.some((row) => row.display_name === "Bea")).toBe(false);
			expect(after.some((row) => row.display_name === "Ada")).toBe(true);
		});
	});

	it("denies device role reads of habit tables", async ({ skip: skipTest }) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		await expect(
			withDeviceDb(prisma, DEVICE_A, (db) => db.habitAward.findMany())
		).rejects.toThrow();
		await expect(
			withDeviceDb(prisma, DEVICE_A, (db) => db.leaderboardProfile.findMany())
		).rejects.toThrow();
	});
});
