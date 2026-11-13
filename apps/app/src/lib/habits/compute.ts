import { dayBucket } from "../progress/aggregate";
import { computeBadges } from "./badges";
import { applyDailyCap, weekPoints } from "./points";
import { computePersonalBests, computeQuests } from "./quests";
import { computeStreak } from "./streaks";
import type {
	AwardDraft,
	ComputeInput,
	ComputeResult,
	HabitsView,
} from "./types";
import { HABIT_DAILY_POINTS_CAP, HABIT_POINTS } from "./types";
import { utcMonday } from "./week";

function streakAwards(result: ComputeResult["streak"]): AwardDraft[] {
	return Object.entries(result.days).map(([date, day]) => ({
		awardKey: `streak_day:${date}`,
		badgeId: null,
		earnedAt: day.openedAt,
		kind: "streak_day" as const,
		points: HABIT_POINTS.streak_day,
		sourceTaskId: day.taskId,
	}));
}

function badgeAwards(badges: ComputeResult["badges"]): AwardDraft[] {
	return badges
		.filter((badge) => badge.earned && badge.earnedAt)
		.map((badge) => ({
			awardKey: `badge:${badge.id}`,
			badgeId: badge.id,
			earnedAt: badge.earnedAt as string,
			kind: "badge" as const,
			points: HABIT_POINTS.badge,
			sourceTaskId: badge.sourceTaskId,
		}));
}

function questAwards(
	quests: ComputeResult["quests"],
	weekStart: string,
	now: string
): AwardDraft[] {
	return quests
		.filter((quest) => quest.complete)
		.map((quest) => ({
			awardKey: `quest:${weekStart}:${quest.id}`,
			badgeId: null,
			earnedAt: now,
			kind: "quest" as const,
			points: HABIT_POINTS.quest,
			sourceTaskId: null,
		}));
}

export function computeHabits(input: ComputeInput): ComputeResult {
	const streak = computeStreak(input.tasks, input.timezone, input.now);
	const badges = computeBadges(input.tasks, input.timezone, input.now);
	const today = dayBucket(input.now, input.timezone);
	const quests = computeQuests({
		badges,
		now: input.now,
		tasks: input.tasks,
		timezone: input.timezone,
		todayQualified: Boolean(streak.days[today]),
	});
	const weekStart = utcMonday(input.now);
	const drafts = [
		...streakAwards({ ...streak }),
		...badgeAwards(badges),
		...questAwards(quests, weekStart, input.now),
	];
	return {
		awards: applyDailyCap(drafts),
		badges,
		personalBests: computePersonalBests(input.tasks),
		quests,
		streak,
		weekStart,
	};
}

export function emptyHabitsView(timezone = "UTC"): HabitsView {
	const computed = computeHabits({
		now: new Date().toISOString(),
		tasks: [],
		timezone,
	});
	return toHabitsView(computed, timezone, false, false);
}

export function unavailableHabitsView(timezone = "UTC"): HabitsView {
	return { ...emptyHabitsView(timezone), migrationRequired: true };
}

export function toHabitsView(
	computed: ComputeResult,
	timezone: string,
	leaderboardOptedIn: boolean,
	exampleData: boolean,
	migrationRequired = false
): HabitsView {
	return {
		badges: computed.badges,
		bestStreak: computed.streak.best,
		calendar: computed.streak.calendar,
		currentStreak: computed.streak.current,
		dailyCap: HABIT_DAILY_POINTS_CAP,
		exampleData,
		leaderboardOptedIn,
		migrationRequired,
		personalBests: computed.personalBests,
		quests: computed.quests,
		timezone,
		weekPoints: weekPoints(computed.awards, computed.weekStart),
		weekStartsAt: computed.weekStart,
	};
}
