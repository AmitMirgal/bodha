import {
	BookOpen,
	Flag,
	Flame,
	ListChecks,
	Sparkles,
	Target,
} from "lucide-react";
import type { ReactNode } from "react";
import type { BadgeId } from "../lib/habits/types";

export function habitBadgeGlyph(id: BadgeId, className = "size-4"): ReactNode {
	switch (id) {
		case "first_close":
			return <Flag aria-hidden className={className} />;
		case "first_report":
			return <BookOpen aria-hidden className={className} />;
		case "clear_spec":
			return <Sparkles aria-hidden className={className} />;
		case "one_shot":
			return <Target aria-hidden className={className} />;
		case "report_3":
			return <ListChecks aria-hidden className={className} />;
		case "streak_7":
			return <Flame aria-hidden className={className} />;
		default: {
			const exhaustive: never = id;
			throw new Error(`Unhandled badge: ${String(exhaustive)}`);
		}
	}
}
