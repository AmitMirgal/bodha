import { BADGE_CATALOG } from "./catalog";
import { hasClearSpec } from "./spec-heuristic";
import { computeStreak } from "./streaks";
import {
	isClosedCapturedTask,
	isQualifyingStreakTask,
	promptTexts,
} from "./tasks";
import type { BadgeId, BadgeResult, HabitTask, StreakResult } from "./types";
import { BADGE_IDS } from "./types";
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

	const earned: Record<
		BadgeId,
		{ earnedAt: string | null; taskId: string | null }
	> = {
		clear_spec: {
			earnedAt: clearSpec?.finishedAt ?? null,
			taskId: clearSpec?.id ?? null,
		},
		first_close: {
			earnedAt: firstClose?.finishedAt ?? null,
			taskId: firstClose?.id ?? null,
		},
		first_report: {
			earnedAt: firstReport?.reportOpenedAt ?? null,
			taskId: firstReport?.id ?? null,
		},
		one_shot: {
			earnedAt: oneShot?.finishedAt ?? null,
			taskId: oneShot?.id ?? null,
		},
		report_3: {
			earnedAt: thirdOpen?.reportOpenedAt ?? null,
			taskId: thirdOpen?.id ?? null,
		},
		streak_7: {
			earnedAt: seven?.openedAt ?? null,
			taskId: seven?.taskId ?? null,
		},
	};
	return BADGE_IDS.map((id) => {
		const entry = BADGE_CATALOG[id];
		const match = earned[id];
		return badge(
			entry.id,
			entry.title,
			entry.description,
			entry.heuristic,
			match.taskId,
			match.earnedAt
		);
	});
}
