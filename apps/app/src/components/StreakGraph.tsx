"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import {
	contributionGrid,
	dayActivityLabel,
	WEEKDAY_LABELS,
} from "../lib/habits/contribution";
import type { ActivityLevel, CalendarDay } from "../lib/habits/types";
import { STREAK_CALENDAR_WEEKS } from "../lib/habits/types";

function levelClass(level: ActivityLevel): string {
	switch (level) {
		case 0:
			return "bg-muted";
		case 1:
			return "bg-[color-mix(in_srgb,var(--primary)_28%,var(--muted))]";
		case 2:
			return "bg-[color-mix(in_srgb,var(--primary)_48%,var(--muted))]";
		case 3:
			return "bg-[color-mix(in_srgb,var(--primary)_72%,var(--muted))]";
		case 4:
			return "bg-primary";
		default: {
			const exhaustive: never = level;
			throw new Error(`Unhandled level: ${String(exhaustive)}`);
		}
	}
}

function DayCell({ day }: { day: CalendarDay }) {
	if (!day.inRange) {
		return (
			<span
				aria-hidden
				className="block aspect-square min-h-[11px] w-full min-w-[11px] rounded-[2px]"
			/>
		);
	}
	const label = dayActivityLabel(day) ?? day.date;
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					aria-label={label}
					className={`block aspect-square min-h-[11px] w-full min-w-[11px] appearance-none rounded-[2px] border-0 p-0 ${levelClass(day.level)}`}
					title={label}
					type="button"
				/>
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

function LegendSwatch({ level }: { level: ActivityLevel }) {
	return (
		<span
			aria-hidden
			className={`block size-[11px] shrink-0 rounded-[2px] ${levelClass(level)}`}
		/>
	);
}

export function StreakGraph({ calendar }: { calendar: CalendarDay[] }) {
	const { months, weeks } = contributionGrid(calendar);
	const minWidth = weeks.length * 14 + 40;
	return (
		<div className="w-full overflow-x-auto">
			<div className="grid w-full gap-2" style={{ minWidth }}>
				<table className="w-full table-fixed border-separate border-spacing-[3px]">
					<caption className="sr-only">
						Contribution graph of qualifying report opens over the last{" "}
						{STREAK_CALENDAR_WEEKS} weeks
					</caption>
					<colgroup>
						<col className="w-7" />
						{weeks.map((week) => (
							<col key={week[0]?.date ?? "empty"} />
						))}
					</colgroup>
					<thead>
						<tr>
							<td />
							{months.map((month) => (
								<th
									className="h-4 overflow-hidden px-0 text-left font-normal text-[10px] text-muted-foreground"
									colSpan={month.colSpan}
									key={`${month.label}-${month.weekIndex}`}
									scope="colgroup"
								>
									{month.label}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{WEEKDAY_LABELS.map((weekday, row) => (
							<tr key={weekday}>
								<th
									className="pr-1 text-right font-normal text-[10px] text-muted-foreground leading-none"
									scope="row"
								>
									{row % 2 === 0 ? weekday : ""}
								</th>
								{weeks.map((week) => {
									const day = week[row];
									const weekKey = week[0]?.date ?? "empty";
									if (!day) {
										return <td key={`${weekday}-${weekKey}`} />;
									}
									return (
										<td key={day.date}>
											<DayCell day={day} />
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
				<div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
					<span>Less</span>
					<LegendSwatch level={0} />
					<LegendSwatch level={1} />
					<LegendSwatch level={2} />
					<LegendSwatch level={3} />
					<LegendSwatch level={4} />
					<span>More</span>
				</div>
			</div>
		</div>
	);
}
