import { BADGE_IDS, type BadgeId } from "./types";

export interface BadgeCatalogEntry {
	description: string;
	heuristic: boolean;
	id: BadgeId;
	title: string;
}

export const BADGE_CATALOG: Record<BadgeId, BadgeCatalogEntry> = {
	first_close: {
		description:
			"Closed a captured editor task from a device claimed to this account.",
		heuristic: false,
		id: "first_close",
		title: "First close",
	},
	first_report: {
		description: "Opened the learning report for a completed captured task.",
		heuristic: false,
		id: "first_report",
		title: "Report reader",
	},
	clear_spec: {
		description:
			"Closed a task whose first prompt states a goal and a constraint or acceptance criterion.",
		heuristic: true,
		id: "clear_spec",
		title: "Clear spec",
	},
	one_shot: {
		description:
			"Closed a captured task with a single prompt — no re-prompting.",
		heuristic: false,
		id: "one_shot",
		title: "One-shot",
	},
	report_3: {
		description:
			"Opened learning reports for three distinct completed captured tasks.",
		heuristic: false,
		id: "report_3",
		title: "Three reports",
	},
	streak_7: {
		description:
			"Seven consecutive days with a completed captured task whose report you opened.",
		heuristic: false,
		id: "streak_7",
		title: "Seven-day streak",
	},
};

export function isBadgeId(value: string): value is BadgeId {
	return (BADGE_IDS as readonly string[]).includes(value);
}

export function badgeCatalogEntry(id: string): BadgeCatalogEntry {
	if (isBadgeId(id)) {
		return BADGE_CATALOG[id];
	}
	return {
		description: "Unknown badge.",
		heuristic: false,
		id: "first_close",
		title: id,
	};
}
