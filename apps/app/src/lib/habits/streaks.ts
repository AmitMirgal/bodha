import { dayBucket } from "../progress/aggregate";
import { activityLevel, mondayOnOrBefore } from "./contribution";
import { isQualifyingStreakTask } from "./tasks";
import type { HabitTask, StreakDay, StreakResult } from "./types";
import { STREAK_CALENDAR_DAYS, STREAK_CALENDAR_WEEKS } from "./types";
import {
	addCivilDays,
	civilDaysForward,
	nextCivilDay,
	previousCivilDay,
} from "./week";

export function qualifyingDays(
	tasks: HabitTask[],
	timezone: string
): Map<string, StreakDay> {
	const days = new Map<string, StreakDay>();
	for (const task of tasks) {
		if (!(isQualifyingStreakTask(task) && task.reportOpenedAt)) {
			continue;
		}
		const day = dayBucket(task.reportOpenedAt, timezone);
		const existing = days.get(day);
		if (!existing) {
			days.set(day, {
				count: 1,
				openedAt: task.reportOpenedAt,
				taskId: task.id,
			});
			continue;
		}
		const openedAt =
			task.reportOpenedAt < existing.openedAt
				? task.reportOpenedAt
				: existing.openedAt;
		const taskId =
			task.reportOpenedAt < existing.openedAt ? task.id : existing.taskId;
		days.set(day, {
			count: existing.count + 1,
			openedAt,
			taskId,
		});
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

function calendarRange(today: string): string[] {
	const thisMonday = mondayOnOrBefore(today);
	const start = addCivilDays(thisMonday, -7 * (STREAK_CALENDAR_WEEKS - 1));
	return civilDaysForward(start, STREAK_CALENDAR_DAYS);
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
		calendar: calendarRange(today).map((date) => {
			const match = qualified.get(date);
			const inRange = date <= today;
			const count = inRange ? (match?.count ?? 0) : 0;
			return {
				count,
				date,
				inRange,
				level: inRange ? activityLevel(count) : 0,
				qualified: inRange && count > 0,
				taskId: match?.taskId ?? null,
			};
		}),
		current,
		days,
	};
}
