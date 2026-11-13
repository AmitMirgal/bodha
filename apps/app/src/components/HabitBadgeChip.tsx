"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { badgeCatalogEntry, isBadgeId } from "../lib/habits/catalog";
import { habitBadgeGlyph } from "./HabitBadgeGlyph";

export function HabitBadgeChip({ id }: { id: string }) {
	if (!isBadgeId(id)) {
		return null;
	}
	const entry = badgeCatalogEntry(id);
	const label = entry.heuristic ? `${entry.title} (heuristic)` : entry.title;
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					aria-label={label}
					className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-secondary px-2 py-1 text-secondary-foreground text-xs"
					title={label}
					type="button"
				>
					{habitBadgeGlyph(id, "size-3.5")}
					<span>{entry.title}</span>
				</button>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

export function HabitBadgeRow({ ids }: { ids: string[] }) {
	const known = ids.filter(isBadgeId);
	if (known.length === 0) {
		return <span className="text-muted-foreground">—</span>;
	}
	return (
		<ul className="m-0 flex list-none flex-wrap gap-1 p-0">
			{known.map((badgeId) => (
				<li key={badgeId}>
					<HabitBadgeChip id={badgeId} />
				</li>
			))}
		</ul>
	);
}
