import { hasClearSpec } from "./spec-heuristic";
import { computeStreak } from "./streaks";
import {
	isClosedCapturedTask,
	isQualifyingStreakTask,
	promptTexts,
} from "./tasks";
import type { BadgeId, BadgeResult, HabitTask, StreakResult } from "./types";
import { nextCivilDay } from "./week";

function reportHref(taskId: string | null): string | null {
	return taskId ? `/capture/tasks/${taskId}` : null;
}

function firstBy<T>(items: T[], stamp: (item: T) => string): T | null {
	if (items.length === 0) {
		return null;
	}
	return (
		[...items].sort((left, right) =>
			stamp(left).localeCompare(stamp(right))
		)[0] ?? null
	);
}

function badge(
	id: BadgeId,
	title: string,
	description: string,
	heuristic: boolean,
	taskId: string | null,
	earnedAt: string | null
): BadgeResult {
	return {
		description,
		earned: taskId != null && earnedAt != null,
		earnedAt,
		heuristic,
		href: reportHref(taskId),
		id,
		sourceTaskId: taskId,
		title,
	};
}

function firstSevenDayEnd(
	days: StreakResult["days"]
): { date: string; openedAt: string; taskId: string } | null {
	const sorted = Object.keys(days).sort();
	let run = 0;
	let previous: string | null = null;
	for (const date of sorted) {
		if (previous && nextCivilDay(previous) === date) {
			run += 1;
		} else {
			run = 1;
		}
		if (run === 7) {
			const match = days[date];
			if (!match) {
				return null;
			}
			return { date, openedAt: match.openedAt, taskId: match.taskId };
		}
		previous = date;
	}
	return null;
}

export function computeBadges(
	tasks: HabitTask[],
	timezone: string,
	now: string
): BadgeResult[] {
	const closed = tasks.filter(isClosedCapturedTask);
	const opened = tasks.filter(isQualifyingStreakTask);
	const firstClose = firstBy(
		closed,
		(task) => task.finishedAt ?? task.startedAt
	);
	const firstReport = firstBy(
		opened,
		(task) => task.reportOpenedAt ?? task.startedAt
	);
	const clearSpec = firstBy(
		closed.filter((task) => {
			const first = promptTexts(task)[0];
			return first ? hasClearSpec(first) : false;
		}),
		(task) => task.finishedAt ?? task.startedAt
	);
	const oneShot = firstBy(
		closed.filter((task) => promptTexts(task).length === 1),
		(task) => task.finishedAt ?? task.startedAt
	);
	const thirdOpen = [...opened].sort((left, right) =>
		(left.reportOpenedAt ?? "").localeCompare(right.reportOpenedAt ?? "")
	)[2];
	const streak = computeStreak(tasks, timezone, now);
	const seven = firstSevenDayEnd(streak.days);

	return [
		badge(
			"first_close",
			"First close",
			"Closed a captured editor task from a device claimed to this account.",
			false,
			firstClose?.id ?? null,
			firstClose?.finishedAt ?? null
		),
		badge(
			"first_report",
			"Report reader",
			"Opened the learning report for a completed captured task.",
			false,
			firstReport?.id ?? null,
			firstReport?.reportOpenedAt ?? null
		),
		badge(
			"clear_spec",
			"Clear spec",
			"Closed a task whose first prompt states a goal and a constraint or acceptance criterion.",
			true,
			clearSpec?.id ?? null,
			clearSpec?.finishedAt ?? null
		),
		badge(
			"one_shot",
			"One-shot",
			"Closed a captured task with a single prompt — no re-prompting.",
			false,
			oneShot?.id ?? null,
			oneShot?.finishedAt ?? null
		),
		badge(
			"report_3",
			"Three reports",
			"Opened learning reports for three distinct completed captured tasks.",
			false,
			thirdOpen?.id ?? null,
			thirdOpen?.reportOpenedAt ?? null
		),
		badge(
			"streak_7",
			"Seven-day streak",
			"Seven consecutive days with a completed captured task whose report you opened.",
			false,
			seven?.taskId ?? null,
			seven?.openedAt ?? null
		),
	];
}
