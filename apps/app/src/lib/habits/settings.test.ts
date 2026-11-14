import { describe, expect, it } from "vitest";
import {
	leaderboardSettingsWriteError,
	parseLeaderboardSettingsBody,
} from "./settings";

describe("parseLeaderboardSettingsBody", () => {
	it("requires a valid display name when opting in", () => {
		expect(
			parseLeaderboardSettingsBody({ optedIn: true, displayName: "" })
		).toEqual({
			error: "Display names must be 3 to 24 characters.",
			ok: false,
		});
		expect(
			parseLeaderboardSettingsBody({ optedIn: true, displayName: "Ada" })
		).toEqual({ displayName: "Ada", ok: true, optedIn: true });
	});

	it("allows opting out without a name", () => {
		expect(parseLeaderboardSettingsBody({ optedIn: false })).toEqual({
			displayName: null,
			ok: true,
			optedIn: false,
		});
		expect(
			parseLeaderboardSettingsBody({ optedIn: false, displayName: "Ada" })
		).toEqual({ displayName: "Ada", ok: true, optedIn: false });
	});

	it("does not treat a toggle as opt-in unless optedIn is boolean true", () => {
		expect(
			parseLeaderboardSettingsBody({ optedIn: "true", displayName: "Ada" })
		).toEqual({
			displayName: "Ada",
			ok: true,
			optedIn: false,
		});
	});
});

describe("leaderboardSettingsWriteError", () => {
	it("maps the production P2003 missing-profiles FK", () => {
		const error = Object.assign(
			new Error(
				"Invalid `prisma.leaderboardProfile.upsert()` invocation:\n\nForeign key constraint violated on the constraint: `leaderboard_profiles_user_id_fkey`"
			),
			{
				code: "P2003",
				meta: { constraint: "leaderboard_profiles_user_id_fkey" },
			}
		);
		expect(leaderboardSettingsWriteError(error)).toEqual({
			error:
				"Your account profile is not ready yet. Sign out and sign in again, then retry.",
			status: 409,
		});
	});

	it("maps a CHECK failure instead of calling it a missing migration", () => {
		const error = Object.assign(
			new Error("Invalid `prisma.leaderboardProfile.upsert()`"),
			{
				code: "P2004",
				meta: {
					constraint: "leaderboard_profiles_display_name_format",
				},
			}
		);
		expect(leaderboardSettingsWriteError(error)).toEqual({
			error:
				"Use letters, numbers, spaces, dots, hyphens, or underscores. No email addresses.",
			status: 400,
		});
	});

	it("maps an opt-in-without-name CHECK", () => {
		const error = Object.assign(new Error("check constraint"), {
			code: "P2010",
			meta: {
				code: "23514",
				message:
					'new row for relation "leaderboard_profiles" violates check constraint "leaderboard_profiles_opt_in_requires_name"',
			},
		});
		expect(leaderboardSettingsWriteError(error)?.status).toBe(400);
		expect(leaderboardSettingsWriteError(error)?.error).toMatch(
			/display name/i
		);
	});
});
