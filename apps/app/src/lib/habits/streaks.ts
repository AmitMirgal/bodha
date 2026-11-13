import { dayBucket } from "../progress/aggregate";
import { isQualifyingStreakTask } from "./tasks";
import type { HabitTask, StreakResult } from "./types";
import { STREAK_CALENDAR_DAYS } from "./types";
import { civilDaysBack, nextCivilDay, previousCivilDay } from "./week";

export function qualifyingDays(
	tasks: HabitTask[],
	timezone: string
): Map<string, { openedAt: string; taskId: string }> {
	const days = new Map<string, { openedAt: string; taskId: string }>();
	for (const task of tasks) {
		if (!(isQualifyingStreakTask(task) && task.reportOpenedAt)) {
			continue;
		}
		const day = dayBucket(task.reportOpenedAt, timezone);
		const existing = days.get(day);
		if (!existing || task.reportOpenedAt < existing.openedAt) {
			days.set(day, { openedAt: task.reportOpenedAt, taskId: task.id });
		}
	}
	return days;
}

function runEndingAt(days: Set<string>, end: string): number {
	let count = 0;
	let cursor = end;
	while (days.has(cursor)) {
		count += 1;
		cursor = previousCivilDay(cursor);
	}
	return count;
}

function bestRun(sortedDays: string[]): number {
	let best = 0;
	let run = 0;
	let previous: string | null = null;
	for (const day of sortedDays) {
		if (previous && nextCivilDay(previous) === day) {
			run += 1;
		} else {
			run = 1;
		}
		best = Math.max(best, run);
		previous = day;
	}
	return best;
}

export function computeStreak(
	tasks: HabitTask[],
	timezone: string,
	now: string
): StreakResult {
	const qualified = qualifyingDays(tasks, timezone);
	const today = dayBucket(now, timezone);
	const daySet = new Set(qualified.keys());
	const yesterday = previousCivilDay(today);
	let current = 0;
	if (daySet.has(today)) {
		current = runEndingAt(daySet, today);
	} else if (daySet.has(yesterday)) {
		current = runEndingAt(daySet, yesterday);
	}
	const days: StreakResult["days"] = {};
	for (const [date, value] of qualified) {
		days[date] = value;
	}
	return {
		best: bestRun([...daySet].sort()),
		calendar: civilDaysBack(today, STREAK_CALENDAR_DAYS).map((date) => ({
			date,
			qualified: daySet.has(date),
			taskId: qualified.get(date)?.taskId ?? null,
		})),
		current,
		days,
	};
}
