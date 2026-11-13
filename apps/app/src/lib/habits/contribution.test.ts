import { describe, expect, it } from "vitest";
import {
	activityLevel,
	contributionGrid,
	dayActivityLabel,
	mondayOnOrBefore,
	weekdayMonday0,
} from "./contribution";
import type { CalendarDay } from "./types";

function day(date: string, count: number, inRange = true): CalendarDay {
	return {
		count,
		date,
		inRange,
		level: activityLevel(count),
		qualified: inRange && count > 0,
		taskId: count > 0 ? "t" : null,
	};
}

describe("contribution graph", () => {
	it("maps report counts onto four activity levels", () => {
		expect(activityLevel(0)).toBe(0);
		expect(activityLevel(1)).toBe(1);
		expect(activityLevel(2)).toBe(2);
		expect(activityLevel(3)).toBe(3);
		expect(activityLevel(8)).toBe(4);
	});

	it("treats civil dates as Monday-first weeks", () => {
		expect(weekdayMonday0("2026-11-09")).toBe(0);
		expect(weekdayMonday0("2026-11-13")).toBe(4);
		expect(weekdayMonday0("2026-11-15")).toBe(6);
		expect(mondayOnOrBefore("2026-11-13")).toBe("2026-11-09");
	});

	it("groups days into weeks with month labels", () => {
		const calendar: CalendarDay[] = [];
		const cursor = new Date("2026-06-29T12:00:00.000Z");
		for (let index = 0; index < 140; index += 1) {
			calendar.push(day(cursor.toISOString().slice(0, 10), 0));
			cursor.setUTCDate(cursor.getUTCDate() + 1);
		}
		const { months, weeks } = contributionGrid(calendar);
		expect(weeks).toHaveLength(20);
		expect(weeks[0]?.[0]?.date).toBe("2026-06-29");
		expect(weekdayMonday0(weeks[0]?.[0]?.date ?? "")).toBe(0);
		expect(months.some((month) => month.label === "Jul")).toBe(true);
		expect(months.some((month) => month.label === "Nov")).toBe(true);
		expect(dayActivityLabel(day("2026-11-13", 2))).toContain(
			"2 completed captured-task reports opened"
		);
	});
});
