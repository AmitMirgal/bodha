import type { AwardDraft, AwardKind } from "./types";
import { HABIT_DAILY_POINTS_CAP } from "./types";
import { utcDay, utcMonday } from "./week";

function kindRank(kind: AwardKind): number {
	switch (kind) {
		case "streak_day":
			return 0;
		case "badge":
			return 1;
		case "quest":
			return 2;
		default: {
			const exhaustive: never = kind;
			throw new Error(`Unhandled award kind: ${String(exhaustive)}`);
		}
	}
}

export function applyDailyCap(
	awards: AwardDraft[],
	cap: number = HABIT_DAILY_POINTS_CAP
): AwardDraft[] {
	const grouped = new Map<string, AwardDraft[]>();
	for (const award of awards) {
		const day = utcDay(award.earnedAt);
		const list = grouped.get(day) ?? [];
		list.push(award);
		grouped.set(day, list);
	}
	const capped: AwardDraft[] = [];
	for (const list of grouped.values()) {
		const sorted = [...list].sort((left, right) => {
			const byKind = kindRank(left.kind) - kindRank(right.kind);
			if (byKind !== 0) {
				return byKind;
			}
			const byTime = left.earnedAt.localeCompare(right.earnedAt);
			if (byTime !== 0) {
				return byTime;
			}
			return left.awardKey.localeCompare(right.awardKey);
		});
		let used = 0;
		for (const award of sorted) {
			const remaining = cap - used;
			if (remaining <= 0) {
				break;
			}
			const points = Math.min(award.points, remaining);
			capped.push({ ...award, points });
			used += points;
		}
	}
	return capped.sort((left, right) =>
		left.awardKey.localeCompare(right.awardKey)
	);
}

export function weekPoints(awards: AwardDraft[], weekStart: string): number {
	return awards
		.filter((award) => utcMonday(award.earnedAt) === weekStart)
		.reduce((sum, award) => sum + award.points, 0);
}
