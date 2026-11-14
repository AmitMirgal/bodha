import { describe, expect, it } from "vitest";
import {
	GamificationMigrationRequiredError,
	isMissingGamificationSchema,
} from "./schema";

describe("isMissingGamificationSchema", () => {
	it("matches the production leaderboard P2010", () => {
		const error = Object.assign(new Error("Invalid `prisma.$queryRaw()`"), {
			code: "P2010",
			meta: {
				code: "42883",
				message:
					"function public.mati_leaderboard_week(date, integer) does not exist",
			},
		});
		expect(isMissingGamificationSchema(error)).toBe(true);
	});

	it("matches a missing habit_awards table", () => {
		const error = Object.assign(
			new Error(
				"The table `public.habit_awards` does not exist in the current database."
			),
			{ code: "P2021" }
		);
		expect(isMissingGamificationSchema(error)).toBe(true);
	});

	it("does not swallow unrelated Prisma errors", () => {
		const error = Object.assign(new Error("Unique constraint failed"), {
			code: "P2002",
		});
		expect(isMissingGamificationSchema(error)).toBe(false);
		expect(isMissingGamificationSchema(new Error("connect ETIMEDOUT"))).toBe(
			false
		);
	});

	it("does not treat a leaderboard CHECK failure as a missing migration", () => {
		const error = Object.assign(
			new Error("Invalid `prisma.leaderboardProfile.upsert()`"),
			{
				code: "P2010",
				meta: {
					code: "23514",
					message:
						'new row for relation "leaderboard_profiles" violates check constraint "leaderboard_profiles_display_name_format"',
				},
			}
		);
		expect(isMissingGamificationSchema(error)).toBe(false);
	});

	it("matches the typed migration error", () => {
		expect(
			isMissingGamificationSchema(new GamificationMigrationRequiredError())
		).toBe(true);
	});
});
