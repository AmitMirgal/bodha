export const HABIT_DAILY_POINTS_CAP = 40;

export const HABIT_POINTS = {
	badge: 20,
	quest: 15,
	streak_day: 5,
} as const;

export const LEADERBOARD_TOP_N = 20;
export const STREAK_CALENDAR_DAYS = 28;

export const BADGE_IDS = [
	"first_close",
	"first_report",
	"clear_spec",
	"one_shot",
	"report_3",
	"streak_7",
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

export type AwardKind = "badge" | "quest" | "streak_day";

export interface HabitPrompt {
	id: string;
	occurredAt: string;
	text: string;
}

export interface HabitTask {
	claimedByUser: boolean;
	finishedAt: string | null;
	id: string;
	prompts: HabitPrompt[];
	reportOpenedAt: string | null;
	startedAt: string;
	status: string;
}

export interface AwardDraft {
	awardKey: string;
	badgeId: BadgeId | null;
	earnedAt: string;
	kind: AwardKind;
	points: number;
	sourceTaskId: string | null;
}

export interface StreakDay {
	openedAt: string;
	taskId: string;
}

export interface StreakResult {
	best: number;
	calendar: Array<{ date: string; qualified: boolean; taskId: string | null }>;
	current: number;
	days: Record<string, StreakDay>;
}

export interface BadgeResult {
	description: string;
	earned: boolean;
	earnedAt: string | null;
	heuristic: boolean;
	href: string | null;
	id: BadgeId;
	sourceTaskId: string | null;
	title: string;
}

export interface QuestResult {
	complete: boolean;
	detail: string;
	heuristic: boolean;
	id: string;
	title: string;
}

export interface PersonalBest {
	href: string | null;
	label: string;
	value: string;
}

export interface ComputeInput {
	now: string;
	tasks: HabitTask[];
	timezone: string;
}

export interface HabitsView {
	badges: BadgeResult[];
	bestStreak: number;
	calendar: StreakResult["calendar"];
	currentStreak: number;
	dailyCap: number;
	exampleData: boolean;
	leaderboardOptedIn: boolean;
	personalBests: PersonalBest[];
	quests: QuestResult[];
	timezone: string;
	weekPoints: number;
	weekStartsAt: string;
}

export interface ComputeResult {
	awards: AwardDraft[];
	badges: BadgeResult[];
	personalBests: PersonalBest[];
	quests: QuestResult[];
	streak: StreakResult;
	weekStart: string;
}

export interface LeaderboardEntry {
	badgeIds: string[];
	displayName: string | null;
	optedIn: boolean;
	points: number;
	userId: string;
}

export interface LeaderboardRow {
	badgeIds: string[];
	displayName: string;
	isSelf: boolean;
	points: number;
	rank: number;
}

export interface LeaderboardView {
	exampleData: boolean;
	optedIn: boolean;
	rows: LeaderboardRow[];
	self: LeaderboardRow | null;
	topN: number;
	weekStartsAt: string;
}
