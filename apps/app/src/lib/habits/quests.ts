import { dayBucket } from "../progress/aggregate";
import { CLEAR_SPEC_HEURISTIC } from "./spec-heuristic";
import {
	isClosedCapturedTask,
	isQualifyingStreakTask,
	promptTexts,
} from "./tasks";
import type {
	BadgeResult,
	HabitTask,
	PersonalBest,
	QuestResult,
} from "./types";
import { utcMonday } from "./week";

function badgeById(badges: BadgeResult[], id: string): BadgeResult | undefined {
	return badges.find((badge) => badge.id === id);
}

function earnedThisWeek(
	badge: BadgeResult | undefined,
	weekStart: string
): boolean {
	return Boolean(
		badge?.earned && badge.earnedAt && utcMonday(badge.earnedAt) === weekStart
	);
}

function openDaysThisWeek(
	tasks: HabitTask[],
	timezone: string,
	weekStart: string
): Set<string> {
	const days = new Set<string>();
	for (const task of tasks) {
		if (!(isQualifyingStreakTask(task) && task.reportOpenedAt)) {
			continue;
		}
		if (utcMonday(task.reportOpenedAt) !== weekStart) {
			continue;
		}
		days.add(dayBucket(task.reportOpenedAt, timezone));
	}
	return days;
}

function fewestPrompts(tasks: HabitTask[]): PersonalBest | null {
	const closed = tasks
		.filter(isClosedCapturedTask)
		.map((task) => ({
			count: promptTexts(task).length,
			href: `/capture/tasks/${task.id}`,
			id: task.id,
		}))
		.filter((task) => task.count > 0)
		.sort(
			(left, right) =>
				left.count - right.count || left.id.localeCompare(right.id)
		);
	const best = closed[0];
	if (!best) {
		return null;
	}
	const rePrompts = Math.max(0, best.count - 1);
	return {
		href: best.href,
		label: "Fewest re-prompts on a completed task",
		value:
			rePrompts === 0
				? "0 re-prompts (one prompt)"
				: `${rePrompts} re-prompts (${best.count} prompts)`,
	};
}

export function computePersonalBests(tasks: HabitTask[]): PersonalBest[] {
	const fewest = fewestPrompts(tasks);
	const opened = tasks.filter(isQualifyingStreakTask).length;
	return [
		fewest ?? {
			href: null,
			label: "Fewest re-prompts on a completed task",
			value: "None yet",
		},
		{
			href: null,
			label: "Completed-task reports opened",
			value: String(opened),
		},
	];
}

export function computeQuests(input: {
	badges: BadgeResult[];
	now: string;
	tasks: HabitTask[];
	timezone: string;
	todayQualified: boolean;
}): QuestResult[] {
	const weekStart = utcMonday(input.now);
	const order = [
		"first_close",
		"first_report",
		"clear_spec",
		"one_shot",
		"report_3",
		"streak_7",
	] as const;
	let gap: QuestResult | null = null;
	for (const id of order) {
		const found = badgeById(input.badges, id);
		if (!found) {
			continue;
		}
		if (!found.earned) {
			gap = questForBadge(found);
			break;
		}
		if (earnedThisWeek(found, weekStart)) {
			gap = { ...questForBadge(found), complete: true };
			break;
		}
	}
	if (!gap) {
		gap = beatBestQuest(input.tasks, weekStart);
	}

	const openDays = openDaysThisWeek(input.tasks, input.timezone, weekStart);
	const cadence: QuestResult = input.todayQualified
		? {
				complete: openDays.size >= 3,
				detail:
					"Open completed-task reports on 3 different days this week (Monday 00:00 UTC).",
				heuristic: false,
				id: "week_three_days",
				title: "Three report days this week",
			}
		: {
				complete: false,
				detail:
					"Open the learning report for a completed captured task today to continue your streak.",
				heuristic: false,
				id: "open_today",
				title: "Open a completed-task report today",
			};

	return [gap, cadence];
}

function questForBadge(badge: BadgeResult): QuestResult {
	switch (badge.id) {
		case "first_close":
			return {
				complete: false,
				detail:
					"Finish a captured editor task (session_end) on a claimed device.",
				heuristic: false,
				id: "quest_first_close",
				title: "Complete your first captured task",
			};
		case "first_report":
			return {
				complete: false,
				detail: "Open the learning report for a completed captured task.",
				heuristic: false,
				id: "quest_first_report",
				title: "Read a completed-task report",
			};
		case "clear_spec":
			return {
				complete: false,
				detail: CLEAR_SPEC_HEURISTIC,
				heuristic: true,
				id: "quest_clear_spec",
				title: "Write a prompt with a goal and a constraint",
			};
		case "one_shot":
			return {
				complete: false,
				detail:
					"Close a captured task that has exactly one prompt, then open its report.",
				heuristic: false,
				id: "quest_one_shot",
				title: "Finish a task without re-prompting",
			};
		case "report_3":
			return {
				complete: false,
				detail: "Open reports for three distinct completed captured tasks.",
				heuristic: false,
				id: "quest_report_3",
				title: "Open three learning reports",
			};
		case "streak_7":
			return {
				complete: false,
				detail:
					"Keep a 7-day streak of completed captured tasks whose reports you opened.",
				heuristic: false,
				id: "quest_streak_7",
				title: "Reach a 7-day streak",
			};
		default: {
			const exhaustive: never = badge.id;
			throw new Error(`Unhandled badge quest: ${String(exhaustive)}`);
		}
	}
}

function beatBestQuest(tasks: HabitTask[], weekStart: string): QuestResult {
	const prior = tasks
		.filter(
			(task) =>
				isClosedCapturedTask(task) &&
				task.finishedAt != null &&
				utcMonday(task.finishedAt) !== weekStart
		)
		.map((task) => promptTexts(task).length)
		.filter((count) => count > 1);
	const best = prior.length > 0 ? Math.min(...prior) : null;
	if (best == null) {
		const openedThisWeek = tasks.filter(
			(task) =>
				isQualifyingStreakTask(task) &&
				task.reportOpenedAt != null &&
				utcMonday(task.reportOpenedAt) === weekStart
		).length;
		return {
			complete: openedThisWeek >= 3,
			detail: "Open reports for three completed captured tasks this week.",
			heuristic: false,
			id: "quest_three_reports_week",
			title: "Open three reports this week",
		};
	}
	const beaten = tasks.some((task) => {
		if (!isClosedCapturedTask(task) || task.finishedAt == null) {
			return false;
		}
		if (utcMonday(task.finishedAt) !== weekStart) {
			return false;
		}
		const count = promptTexts(task).length;
		return count > 0 && count < best;
	});
	return {
		complete: beaten,
		detail: `Close a captured task with fewer than ${best} prompts (your previous best).`,
		heuristic: false,
		id: "quest_beat_best",
		title: "Beat your fewest-prompt best",
	};
}
