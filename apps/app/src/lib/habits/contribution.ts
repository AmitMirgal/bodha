import type { ActivityLevel, CalendarDay } from "./types";
import { utcMonday } from "./week";

export const WEEKDAY_LABELS = [
	"Mon",
	"Tue",
	"Wed",
	"Thu",
	"Fri",
	"Sat",
	"Sun",
] as const;

export function activityLevel(count: number): ActivityLevel {
	if (count <= 0) {
		return 0;
	}
	if (count === 1) {
		return 1;
	}
	if (count === 2) {
		return 2;
	}
	if (count === 3) {
		return 3;
	}
	return 4;
}

export function mondayOnOrBefore(day: string): string {
	return utcMonday(`${day}T12:00:00.000Z`);
}

export function weekdayMonday0(day: string): number {
	const [year, month, date] = day.split("-").map(Number);
	const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
	return weekday === 0 ? 6 : weekday - 1;
}

export function shortMonth(day: string): string {
	return new Date(`${day}T12:00:00.000Z`).toLocaleString("en-US", {
		month: "short",
		timeZone: "UTC",
	});
}

export function dayActivityLabel(day: CalendarDay): string | null {
	if (!day.inRange) {
		return null;
	}
	if (day.count === 0) {
		return `${day.date}, no qualifying report`;
	}
	if (day.count === 1) {
		return `${day.date}, 1 completed captured-task report opened`;
	}
	return `${day.date}, ${day.count} completed captured-task reports opened`;
}

export interface MonthLabel {
	colSpan: number;
	label: string;
	weekIndex: number;
}

export interface ContributionGrid {
	months: MonthLabel[];
	weeks: CalendarDay[][];
}

export function contributionGrid(calendar: CalendarDay[]): ContributionGrid {
	const weeks: CalendarDay[][] = [];
	for (let index = 0; index < calendar.length; index += 7) {
		weeks.push(calendar.slice(index, index + 7));
	}
	const starts: Array<{ label: string; weekIndex: number }> = [];
	const seen = new Set<string>();
	weeks.forEach((week, weekIndex) => {
		const firstOfMonth = week.find(
			(day) => day.inRange && day.date.endsWith("-01")
		);
		const start = week.find((day) => day.inRange);
		const labelDay = firstOfMonth ?? (weekIndex === 0 ? start : undefined);
		if (!labelDay) {
			return;
		}
		const key = labelDay.date.slice(0, 7);
		if (seen.has(key)) {
			return;
		}
		starts.push({ label: shortMonth(labelDay.date), weekIndex });
		seen.add(key);
	});
	const months = starts.map((start, index) => {
		const next = starts[index + 1];
		return {
			colSpan: (next?.weekIndex ?? weeks.length) - start.weekIndex,
			label: start.label,
			weekIndex: start.weekIndex,
		};
	});
	return { months, weeks };
}
