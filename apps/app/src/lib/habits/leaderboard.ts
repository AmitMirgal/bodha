import type { LeaderboardEntry, LeaderboardRow } from "./types";
import { LEADERBOARD_TOP_N } from "./types";

export function visibleLeaderboard(
	entries: LeaderboardEntry[],
	viewerId: string,
	topN: number = LEADERBOARD_TOP_N
): { rows: LeaderboardRow[]; self: LeaderboardRow | null } {
	const opted = entries.filter(
		(entry) =>
			entry.optedIn && entry.displayName != null && entry.displayName.length > 0
	);
	const ranked = [...opted]
		.sort((left, right) => {
			if (right.points !== left.points) {
				return right.points - left.points;
			}
			const byName = (left.displayName ?? "").localeCompare(
				right.displayName ?? ""
			);
			if (byName !== 0) {
				return byName;
			}
			return left.userId.localeCompare(right.userId);
		})
		.map((entry, index) => ({
			badgeIds: [...entry.badgeIds].sort(),
			displayName: entry.displayName as string,
			isSelf: entry.userId === viewerId,
			points: entry.points,
			rank: index + 1,
			userId: entry.userId,
		}));

	const rows = ranked
		.filter((row) => row.rank <= topN)
		.map(({ userId: _userId, ...row }) => row);
	const selfFull = ranked.find((row) => row.userId === viewerId) ?? null;
	const self = selfFull
		? {
				badgeIds: selfFull.badgeIds,
				displayName: selfFull.displayName,
				isSelf: true,
				points: selfFull.points,
				rank: selfFull.rank,
			}
		: null;
	if (self && !rows.some((row) => row.isSelf)) {
		return { rows: [...rows, self], self };
	}
	return { rows, self };
}
