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
	USER_B,
} from "../rls/harness";
import {
	loadLeaderboardSettings,
	loadLeaderboardView,
	saveLeaderboardSettings,
} from "./load";
import { LeaderboardSettingsError } from "./settings";

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
      insert into auth.users (id, email) values
        ('${USER_A}', 'a@example.com'),
        ('${USER_B}', 'b@example.com');
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

describe("leaderboard opt-in settings", () => {
	it("records why the isolated Prisma path is unavailable when skipped", () => {
		if (!prisma) {
			expect.fail(`Prisma PGlite RLS harness unavailable: ${skip}`);
		}
		expect(prisma).toBeTruthy();
	});

	it("opts in with a display name and shows that row as self on the board", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		const saved = await withUserDb(prisma, USER_A, (db) =>
			saveLeaderboardSettings(db, USER_A, {
				displayName: "Ada",
				optedIn: true,
			})
		);
		expect(saved).toEqual({ displayName: "Ada", optedIn: true });
		const loaded = await withUserDb(prisma, USER_A, (db) =>
			loadLeaderboardSettings(db, USER_A)
		);
		expect(loaded).toEqual({ displayName: "Ada", optedIn: true });
		const view = await withUserDb(prisma, USER_A, (db) =>
			loadLeaderboardView(db, USER_A, "UTC", "2026-11-13T18:00:00.000Z")
		);
		expect(view.optedIn).toBe(true);
		expect(view.self?.displayName).toBe("Ada");
		expect(view.self?.isSelf).toBe(true);
		expect(
			view.rows.some((row) => row.isSelf && row.displayName === "Ada")
		).toBe(true);
	});

	it("creates a missing profiles row so opt-in does not 500 with P2003", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		const saved = await withUserDb(prisma, USER_B, (db) =>
			saveLeaderboardSettings(db, USER_B, {
				displayName: "Bea",
				optedIn: true,
			})
		);
		expect(saved).toEqual({ displayName: "Bea", optedIn: true });
		const profile = await withUserDb(prisma, USER_B, (db) =>
			db.profile.findUnique({ where: { id: USER_B } })
		);
		expect(profile?.id).toBe(USER_B);
		const view = await withUserDb(prisma, USER_B, (db) =>
			loadLeaderboardView(db, USER_B, "UTC", "2026-11-13T18:00:00.000Z")
		);
		expect(view.self?.displayName).toBe("Bea");
	});

	it("rejects opt-in without a display name before hitting the CHECK", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		await expect(
			withUserDb(prisma, USER_A, (db) =>
				saveLeaderboardSettings(db, USER_A, {
					displayName: null,
					optedIn: true,
				})
			)
		).rejects.toBeInstanceOf(LeaderboardSettingsError);
	});

	it("opts out immediately so the board no longer lists the name", async ({
		skip: skipTest,
	}) => {
		if (!prisma) {
			skipTest(skip);
			return;
		}
		await withUserDb(prisma, USER_A, (db) =>
			saveLeaderboardSettings(db, USER_A, {
				displayName: "Ada",
				optedIn: false,
			})
		);
		const view = await withUserDb(prisma, USER_A, (db) =>
			loadLeaderboardView(db, USER_A, "UTC", "2026-11-13T18:00:00.000Z")
		);
		expect(view.optedIn).toBe(false);
		expect(view.self).toBeNull();
		expect(view.rows.some((row) => row.displayName === "Ada")).toBe(false);
	});
});
