import { describe, expect, it } from "vitest";
import { parseDisplayName } from "./display-name";
import { visibleLeaderboard } from "./leaderboard";
import type { LeaderboardEntry } from "./types";

const viewer = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function entry(
	input: Partial<LeaderboardEntry> & {
		userId: string;
		displayName: string | null;
	}
): LeaderboardEntry {
	return {
		badgeIds: [],
		optedIn: true,
		points: 0,
		...input,
	};
}

describe("parseDisplayName", () => {
	it("accepts 3-24 letters, numbers, spaces, dots, hyphens, and underscores", () => {
		expect(parseDisplayName("Amy")).toEqual({ name: "Amy" });
		expect(parseDisplayName("  Dev_One-2.0  ")).toEqual({
			name: "Dev_One-2.0",
		});
	});

	it("rejects emails, short names, and symbols", () => {
		expect(parseDisplayName("ab")).toMatchObject({ error: expect.any(String) });
		expect(parseDisplayName("a@b.com")).toMatchObject({
			error: expect.any(String),
		});
		expect(parseDisplayName("hi!")).toMatchObject({
			error: expect.any(String),
		});
	});
});

describe("visibleLeaderboard", () => {
	it("hides opted-out users immediately and does not require unique names", () => {
		const { rows } = visibleLeaderboard(
			[
				entry({
					displayName: "Ada",
					points: 30,
					userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
				}),
				entry({
					displayName: "Ada",
					optedIn: false,
					points: 99,
					userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
				}),
			],
			viewer,
			20
		);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.displayName).toBe("Ada");
		expect(rows[0]?.points).toBe(30);
		expect(rows.some((row) => row.points === 99)).toBe(false);
	});

	it("includes the viewer even when they rank below the top N", () => {
		const entries: LeaderboardEntry[] = Array.from({ length: 5 }, (_, index) =>
			entry({
				displayName: `Top${index}`,
				points: 100 - index,
				userId: `00000000-0000-4000-8000-00000000000${index}`,
			})
		);
		entries.push(
			entry({
				displayName: "Me",
				points: 1,
				userId: viewer,
			})
		);
		const { rows, self } = visibleLeaderboard(entries, viewer, 3);
		expect(rows).toHaveLength(4);
		expect(self?.rank).toBe(6);
		expect(self?.displayName).toBe("Me");
		expect(rows.filter((row) => row.isSelf)).toHaveLength(1);
		expect(rows.every((row) => !("userId" in row))).toBe(true);
	});

	it("returns no self rank when the viewer has not opted in", () => {
		const { rows, self } = visibleLeaderboard(
			[
				entry({
					displayName: "Ada",
					points: 10,
					userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
				}),
				entry({
					displayName: null,
					optedIn: false,
					points: 50,
					userId: viewer,
				}),
			],
			viewer,
			20
		);
		expect(self).toBeNull();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.isSelf).toBe(false);
	});
});
