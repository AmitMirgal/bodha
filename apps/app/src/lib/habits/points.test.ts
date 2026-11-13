import { describe, expect, it } from "vitest";
import { computeHabits } from "./compute";
import { applyDailyCap, weekPoints } from "./points";
import type { AwardDraft, HabitTask } from "./types";
import { HABIT_DAILY_POINTS_CAP, HABIT_POINTS } from "./types";

function award(
	input: Partial<AwardDraft> & { awardKey: string; earnedAt: string }
): AwardDraft {
	return {
		badgeId: null,
		kind: "badge",
		points: HABIT_POINTS.badge,
		sourceTaskId: null,
		...input,
	};
}

describe("applyDailyCap", () => {
	it("caps points per UTC day without dropping earlier awards", () => {
		const capped = applyDailyCap(
			[
				award({
					awardKey: "badge:first_close",
					earnedAt: "2026-11-13T10:00:00.000Z",
					points: 20,
				}),
				award({
					awardKey: "badge:first_report",
					earnedAt: "2026-11-13T11:00:00.000Z",
					points: 20,
				}),
				award({
					awardKey: "badge:clear_spec",
					earnedAt: "2026-11-13T12:00:00.000Z",
					points: 20,
				}),
				award({
					awardKey: "streak_day:2026-11-13",
					earnedAt: "2026-11-13T09:00:00.000Z",
					kind: "streak_day",
					points: 5,
				}),
			],
			HABIT_DAILY_POINTS_CAP
		);
		const total = capped.reduce((sum, item) => sum + item.points, 0);
		expect(total).toBe(HABIT_DAILY_POINTS_CAP);
		expect(
			capped.find((item) => item.awardKey === "streak_day:2026-11-13")?.points
		).toBe(5);
		expect(
			capped.find((item) => item.awardKey === "badge:clear_spec")
		).toBeUndefined();
		expect(
			capped.find((item) => item.awardKey === "badge:first_report")?.points
		).toBe(15);
	});

	it("does not let one day's remainder reduce the next UTC day", () => {
		const capped = applyDailyCap([
			award({
				awardKey: "badge:first_close",
				earnedAt: "2026-11-12T23:00:00.000Z",
				points: 20,
			}),
			award({
				awardKey: "badge:first_report",
				earnedAt: "2026-11-13T00:01:00.000Z",
				points: 20,
			}),
		]);
		expect(capped).toHaveLength(2);
		expect(capped.every((item) => item.points === 20)).toBe(true);
	});
});

describe("weekly reset", () => {
	it("assigns Sunday UTC to the previous Monday week and Monday 00:00 UTC to the new week", () => {
		const sunday = award({
			awardKey: "streak_day:2026-11-15",
			earnedAt: "2026-11-15T23:00:00.000Z",
			kind: "streak_day",
			points: 5,
		});
		const monday = award({
			awardKey: "streak_day:2026-11-16",
			earnedAt: "2026-11-16T00:00:00.000Z",
			kind: "streak_day",
			points: 5,
		});
		expect(weekPoints([sunday, monday], "2026-11-09")).toBe(5);
		expect(weekPoints([sunday, monday], "2026-11-16")).toBe(5);
	});
});

describe("computeHabits points", () => {
	it("scores only claimed closed tasks with opened reports for streak days", () => {
		const tasks: HabitTask[] = [
			{
				claimedByUser: true,
				finishedAt: "2026-11-16T12:00:00.000Z",
				id: "a",
				prompts: [
					{
						id: "p",
						occurredAt: "2026-11-16T11:00:00.000Z",
						text: "Implement login so that empty passwords must fail.",
					},
				],
				reportOpenedAt: "2026-11-16T12:00:00.000Z",
				startedAt: "2026-11-16T11:00:00.000Z",
				status: "closed",
			},
		];
		const result = computeHabits({
			now: "2026-11-16T18:00:00.000Z",
			tasks,
			timezone: "UTC",
		});
		expect(result.weekStart).toBe("2026-11-16");
		expect(
			result.awards.every((item) => item.points <= HABIT_DAILY_POINTS_CAP)
		).toBe(true);
		expect(weekPoints(result.awards, result.weekStart)).toBe(
			HABIT_DAILY_POINTS_CAP
		);
		expect(weekPoints(result.awards, "2026-11-09")).toBe(0);
		expect(result.awards.some((item) => item.kind === "streak_day")).toBe(true);
		expect(result.awards.some((item) => item.kind === "badge")).toBe(true);
	});
});
