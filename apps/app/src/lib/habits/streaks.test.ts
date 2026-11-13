import { describe, expect, it } from "vitest";
import { computeStreak } from "./streaks";
import type { HabitTask } from "./types";

function task(input: {
	finishedAt: string;
	id: string;
	openedAt: string;
	prompts?: string[];
}): HabitTask {
	return {
		claimedByUser: true,
		finishedAt: input.finishedAt,
		id: input.id,
		prompts: (input.prompts ?? ["do the thing"]).map((text, index) => ({
			id: `${input.id}-p${index}`,
			occurredAt: input.finishedAt,
			text,
		})),
		reportOpenedAt: input.openedAt,
		startedAt: input.finishedAt,
		status: "closed",
	};
}

describe("computeStreak", () => {
	it("counts consecutive timezone days and ignores gaps", () => {
		const streak = computeStreak(
			[
				task({
					finishedAt: "2026-11-10T18:00:00.000Z",
					id: "a",
					openedAt: "2026-11-10T18:00:00.000Z",
				}),
				task({
					finishedAt: "2026-11-11T18:00:00.000Z",
					id: "b",
					openedAt: "2026-11-11T18:00:00.000Z",
				}),
				task({
					finishedAt: "2026-11-13T18:00:00.000Z",
					id: "c",
					openedAt: "2026-11-13T18:00:00.000Z",
				}),
			],
			"UTC",
			"2026-11-13T20:00:00.000Z"
		);
		expect(streak.current).toBe(1);
		expect(streak.best).toBe(2);
		expect(streak.days["2026-11-10"]?.taskId).toBe("a");
		expect(streak.days["2026-11-12"]).toBeUndefined();
	});

	it("keeps yesterday's run as the current streak until today ends", () => {
		const streak = computeStreak(
			[
				task({
					finishedAt: "2026-11-11T12:00:00.000Z",
					id: "a",
					openedAt: "2026-11-11T12:00:00.000Z",
				}),
				task({
					finishedAt: "2026-11-12T12:00:00.000Z",
					id: "b",
					openedAt: "2026-11-12T12:00:00.000Z",
				}),
			],
			"UTC",
			"2026-11-13T15:00:00.000Z"
		);
		expect(streak.current).toBe(2);
		expect(streak.best).toBe(2);
	});

	it("breaks the current streak after a missed day", () => {
		const streak = computeStreak(
			[
				task({
					finishedAt: "2026-11-10T12:00:00.000Z",
					id: "a",
					openedAt: "2026-11-10T12:00:00.000Z",
				}),
			],
			"UTC",
			"2026-11-13T12:00:00.000Z"
		);
		expect(streak.current).toBe(0);
		expect(streak.best).toBe(1);
	});

	it("buckets a late-UTC open onto the previous civil day in America/Los_Angeles", () => {
		const openedAt = "2026-11-13T07:30:00.000Z";
		const utc = computeStreak(
			[task({ finishedAt: openedAt, id: "a", openedAt })],
			"UTC",
			"2026-11-13T08:00:00.000Z"
		);
		const pacific = computeStreak(
			[task({ finishedAt: openedAt, id: "a", openedAt })],
			"America/Los_Angeles",
			"2026-11-13T08:00:00.000Z"
		);
		expect(utc.days["2026-11-13"]).toBeTruthy();
		expect(pacific.days["2026-11-12"]).toBeTruthy();
		expect(pacific.days["2026-11-13"]).toBeUndefined();
	});

	it("does not count unclaimed, open, or unopened tasks", () => {
		const streak = computeStreak(
			[
				{
					claimedByUser: false,
					finishedAt: "2026-11-13T12:00:00.000Z",
					id: "unclaimed",
					prompts: [],
					reportOpenedAt: "2026-11-13T12:00:00.000Z",
					startedAt: "2026-11-13T11:00:00.000Z",
					status: "closed",
				},
				{
					claimedByUser: true,
					finishedAt: null,
					id: "open",
					prompts: [],
					reportOpenedAt: "2026-11-13T12:00:00.000Z",
					startedAt: "2026-11-13T11:00:00.000Z",
					status: "open",
				},
				{
					claimedByUser: true,
					finishedAt: "2026-11-13T12:00:00.000Z",
					id: "closed-unread",
					prompts: [],
					reportOpenedAt: null,
					startedAt: "2026-11-13T11:00:00.000Z",
					status: "closed",
				},
			],
			"UTC",
			"2026-11-13T18:00:00.000Z"
		);
		expect(streak.current).toBe(0);
		expect(streak.best).toBe(0);
		expect(Object.keys(streak.days)).toEqual([]);
	});

	it("counts one day even when two reports open on that day", () => {
		const streak = computeStreak(
			[
				task({
					finishedAt: "2026-11-13T10:00:00.000Z",
					id: "a",
					openedAt: "2026-11-13T10:00:00.000Z",
				}),
				task({
					finishedAt: "2026-11-13T16:00:00.000Z",
					id: "b",
					openedAt: "2026-11-13T16:00:00.000Z",
				}),
			],
			"UTC",
			"2026-11-13T18:00:00.000Z"
		);
		expect(streak.current).toBe(1);
		expect(streak.days["2026-11-13"]?.taskId).toBe("a");
		expect(streak.days["2026-11-13"]?.count).toBe(2);
		const calendarDay = streak.calendar.find(
			(day) => day.date === "2026-11-13"
		);
		expect(calendarDay?.level).toBe(2);
		expect(calendarDay?.count).toBe(2);
	});

	it("builds a Monday-aligned twenty-week contribution calendar", () => {
		const streak = computeStreak([], "UTC", "2026-11-13T18:00:00.000Z");
		expect(streak.calendar).toHaveLength(140);
		expect(streak.calendar[0]?.date).toBe("2026-06-29");
		expect(streak.calendar.at(-1)?.date).toBe("2026-11-15");
		expect(
			streak.calendar.find((day) => day.date === "2026-11-13")?.inRange
		).toBe(true);
		expect(
			streak.calendar.find((day) => day.date === "2026-11-14")?.inRange
		).toBe(false);
	});
});
