import { insertOnce } from "../db/insert-once";
import type { MatiDb } from "../db/rls";
import { computeHabits, toHabitsView } from "./compute";
import { mapCaptureHabitTasks } from "./map-tasks";
import type { AwardDraft, HabitsView, LeaderboardView } from "./types";
import { LEADERBOARD_TOP_N } from "./types";
import { utcDay, utcMonday } from "./week";

function dateOnly(day: string): Date {
	return new Date(`${day}T00:00:00.000Z`);
}

async function loadHabitRows(db: MatiDb, userId: string) {
	return await db.captureTask.findMany({
		include: {
			device: { select: { claimedUserId: true } },
			events: { orderBy: { occurredAt: "asc" } },
			reportOpens: {
				orderBy: { openedAt: "asc" },
				take: 1,
				where: { userId },
			},
		},
		orderBy: { startedAt: "desc" },
		where: { userId },
	});
}

export async function recordCaptureReportOpen(
	db: MatiDb,
	userId: string,
	taskId: string
): Promise<boolean> {
	const task = await db.captureTask.findFirst({
		include: { device: { select: { claimedUserId: true } } },
		where: { id: taskId, userId },
	});
	if (!task) {
		return false;
	}
	if (task.status !== "closed" || task.device.claimedUserId !== userId) {
		return false;
	}
	const result = await insertOnce(
		db,
		() =>
			db.captureReportOpen.create({
				data: { taskId, userId },
			}),
		() =>
			db.captureReportOpen.findFirst({
				where: { taskId, userId },
			})
	);
	return result.created;
}

async function persistAwards(
	db: MatiDb,
	userId: string,
	awards: AwardDraft[]
): Promise<void> {
	for (const award of awards) {
		await insertOnce(
			db,
			() =>
				db.habitAward.create({
					data: {
						awardKey: award.awardKey,
						badgeId: award.badgeId,
						dayBucket: dateOnly(utcDay(award.earnedAt)),
						earnedAt: new Date(award.earnedAt),
						kind: award.kind,
						points: award.points,
						sourceTaskId: award.sourceTaskId,
						userId,
						weekStart: dateOnly(utcMonday(award.earnedAt)),
					},
				}),
			() =>
				db.habitAward.findFirst({
					where: { awardKey: award.awardKey, userId },
				})
		);
	}
}

export async function syncHabits(
	db: MatiDb,
	userId: string,
	timezone: string,
	now: string = new Date().toISOString()
): Promise<{ view: HabitsView; weekStart: string }> {
	const rows = await loadHabitRows(db, userId);
	const computed = computeHabits({
		now,
		tasks: mapCaptureHabitTasks(rows, userId),
		timezone,
	});
	await persistAwards(db, userId, computed.awards);
	const profile = await db.leaderboardProfile.findUnique({
		where: { userId },
	});
	return {
		view: toHabitsView(computed, timezone, Boolean(profile?.optedIn), false),
		weekStart: computed.weekStart,
	};
}

export async function loadHabitsView(
	db: MatiDb,
	userId: string,
	timezone: string
): Promise<HabitsView> {
	const { view } = await syncHabits(db, userId, timezone);
	return view;
}

interface LeaderboardSqlRow {
	badge_ids: string[] | null;
	display_name: string;
	is_self: boolean;
	points: number;
	rank: bigint | number;
}

export async function loadLeaderboardView(
	db: MatiDb,
	userId: string,
	timezone: string,
	now: string = new Date().toISOString()
): Promise<LeaderboardView> {
	const { weekStart } = await syncHabits(db, userId, timezone, now);
	const profile = await db.leaderboardProfile.findUnique({
		where: { userId },
	});
	const sqlRows = await db.$queryRaw<LeaderboardSqlRow[]>`
    SELECT rank, display_name, points, badge_ids, is_self
    FROM public.mati_leaderboard_week(${weekStart}::date, ${LEADERBOARD_TOP_N}::int)`;
	const rows = sqlRows.map((row) => ({
		badgeIds: [...(row.badge_ids ?? [])].sort(),
		displayName: row.display_name,
		isSelf: row.is_self,
		points: row.points,
		rank: Number(row.rank),
	}));
	return {
		exampleData: false,
		optedIn: Boolean(profile?.optedIn),
		rows,
		self: rows.find((row) => row.isSelf) ?? null,
		topN: LEADERBOARD_TOP_N,
		weekStartsAt: weekStart,
	};
}

export async function loadLeaderboardSettings(db: MatiDb, userId: string) {
	const profile = await db.leaderboardProfile.findUnique({
		where: { userId },
	});
	return {
		displayName: profile?.displayName ?? "",
		optedIn: Boolean(profile?.optedIn),
	};
}

export async function saveLeaderboardSettings(
	db: MatiDb,
	userId: string,
	input: { displayName: string | null; optedIn: boolean }
) {
	const now = new Date();
	await db.leaderboardProfile.upsert({
		create: {
			displayName: input.displayName,
			optedIn: input.optedIn,
			userId,
		},
		update: {
			displayName: input.displayName,
			optedIn: input.optedIn,
			updatedAt: now,
		},
		where: { userId },
	});
	return loadLeaderboardSettings(db, userId);
}
