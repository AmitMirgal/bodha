import { computeHabits, toHabitsView } from "./compute";
import type { HabitsView, HabitTask, LeaderboardView } from "./types";
import { LEADERBOARD_TOP_N } from "./types";

const NOW = "2026-11-13T18:00:00.000Z";
const TIMEZONE = "UTC";

function closed(input: {
	finishedAt: string;
	id: string;
	openedAt: string;
	prompts: string[];
}): HabitTask {
	return {
		claimedByUser: true,
		finishedAt: input.finishedAt,
		id: input.id,
		prompts: input.prompts.map((text, index) => ({
			id: `${input.id}-p${index}`,
			occurredAt: input.finishedAt,
			text,
		})),
		reportOpenedAt: input.openedAt,
		startedAt: input.finishedAt,
		status: "closed",
	};
}

function promptsForSeed(index: number): string[] {
	if (index === 0) {
		return [
			"Implement login so that empty passwords must fail the stored assertion.",
		];
	}
	if (index === 3) {
		return ["Fix the flaky test", "just make it pass"];
	}
	return ["Ship the captured report without extra retries."];
}

export function seededHabitTasks(): HabitTask[] {
	const days = ["07", "08", "09", "10", "11", "12", "13"];
	return days.map((day, index) =>
		closed({
			finishedAt: `2026-11-${day}T15:00:00.000Z`,
			id: `cccccccc-cccc-4ccc-8ccc-ccccccccccc${index}`,
			openedAt: `2026-11-${day}T16:00:00.000Z`,
			prompts: promptsForSeed(index),
		})
	);
}

export function seededHabitsView(): HabitsView {
	const computed = computeHabits({
		now: NOW,
		tasks: seededHabitTasks(),
		timezone: TIMEZONE,
	});
	return toHabitsView(computed, TIMEZONE, false, true);
}

export function emptyHabitsView(): HabitsView {
	const computed = computeHabits({
		now: NOW,
		tasks: [],
		timezone: TIMEZONE,
	});
	return toHabitsView(computed, TIMEZONE, false, true);
}

export function seededLeaderboardView(): LeaderboardView {
	return {
		exampleData: true,
		optedIn: true,
		rows: [
			{
				badgeIds: ["first_close", "first_report", "one_shot"],
				displayName: "Ada",
				isSelf: false,
				points: 40,
				rank: 1,
			},
			{
				badgeIds: ["first_close", "clear_spec"],
				displayName: "ExampleYou",
				isSelf: true,
				points: 35,
				rank: 2,
			},
			{
				badgeIds: ["first_report"],
				displayName: "Kai",
				isSelf: false,
				points: 20,
				rank: 3,
			},
			{
				badgeIds: ["first_close"],
				displayName: "Sam",
				isSelf: false,
				points: 5,
				rank: 4,
			},
		],
		self: {
			badgeIds: ["first_close", "clear_spec"],
			displayName: "ExampleYou",
			isSelf: true,
			points: 35,
			rank: 2,
		},
		topN: LEADERBOARD_TOP_N,
		weekStartsAt: "2026-11-09",
	};
}

export function emptyLeaderboardView(): LeaderboardView {
	return {
		exampleData: true,
		optedIn: false,
		rows: [],
		self: null,
		topN: LEADERBOARD_TOP_N,
		weekStartsAt: "2026-11-09",
	};
}
