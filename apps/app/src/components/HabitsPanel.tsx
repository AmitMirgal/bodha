import { Badge } from "@repo/design-system/components/ui/badge";
import { cn } from "@repo/design-system/lib/utils";
import type { BadgeResult, HabitsView } from "../lib/habits/types";
import { habitBadgeGlyph } from "./HabitBadgeGlyph";
import { StreakGraph } from "./StreakGraph";

function streakWord(count: number): string {
	return count === 1 ? "day" : "days";
}

function badgeHint(badge: BadgeResult): string {
	return `${badge.description}${badge.heuristic ? " Heuristic." : ""}`;
}

function SkillBadgeCard({ badge }: { badge: BadgeResult }) {
	const hint = badgeHint(badge);
	const state = badge.earned ? "Earned" : "Locked";
	const name = badge.href ? (
		<a
			className="font-medium text-sm underline underline-offset-2"
			href={badge.href}
		>
			{badge.title}
		</a>
	) : (
		<span className="font-medium text-sm">{badge.title}</span>
	);
	return (
		<li>
			<div
				className={cn(
					"flex items-center gap-2 rounded-md border px-2.5 py-1.5",
					badge.earned
						? "border-border bg-card"
						: "border-border border-dashed text-muted-foreground"
				)}
				title={hint}
			>
				<span className="shrink-0 text-muted-foreground">
					{habitBadgeGlyph(badge.id, "size-3.5")}
				</span>
				<span className="min-w-0 flex-1 leading-tight">{name}</span>
				<Badge variant={badge.earned ? "default" : "outline"}>{state}</Badge>
			</div>
		</li>
	);
}

export function HabitsPanel({ habits }: { habits: HabitsView }) {
	return (
		<section aria-labelledby="habits-heading" className="grid gap-4">
			<div className="grid gap-1.5">
				<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<h2
						className="font-semibold text-lg tracking-tight"
						id="habits-heading"
					>
						Habits
					</h2>
					{habits.exampleData ? (
						<Badge variant="outline">Example data</Badge>
					) : null}
					<p className="text-muted-foreground text-sm">
						<span className="font-medium text-foreground tabular-nums">
							{habits.currentStreak}
						</span>{" "}
						current {streakWord(habits.currentStreak)}
						<span aria-hidden> · </span>
						<span className="font-medium text-foreground tabular-nums">
							{habits.bestStreak}
						</span>{" "}
						best
						<span aria-hidden> · </span>
						<span className="font-medium text-foreground tabular-nums">
							{habits.weekPoints}
						</span>{" "}
						pts this week
					</p>
				</div>
				<p className="max-w-3xl text-muted-foreground text-sm">
					A day counts when you open the report for a completed captured editor
					task ({habits.timezone}). Missed days break the run. Weekly points
					reset Monday 00:00 UTC.
				</p>
			</div>
			<StreakGraph calendar={habits.calendar} />
			<div className="grid items-start gap-6 lg:grid-cols-2">
				<section aria-labelledby="habits-badges" className="grid gap-2">
					<h3 className="font-medium text-sm" id="habits-badges">
						Skill badges
					</h3>
					<ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
						{habits.badges.map((badge) => (
							<SkillBadgeCard badge={badge} key={badge.id} />
						))}
					</ul>
				</section>
				<div className="grid content-start gap-5">
					<section aria-labelledby="habits-bests" className="grid gap-1.5">
						<h3 className="font-medium text-sm" id="habits-bests">
							Personal bests
						</h3>
						<ul className="m-0 grid list-none gap-1 p-0 text-sm">
							{habits.personalBests.map((best) => (
								<li
									className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
									key={best.label}
								>
									<span className="text-muted-foreground">{best.label}</span>
									<span className="font-medium tabular-nums">{best.value}</span>
								</li>
							))}
						</ul>
					</section>
					<section aria-labelledby="habits-quests" className="grid gap-1.5">
						<h3 className="font-medium text-sm" id="habits-quests">
							Weekly quests
						</h3>
						<ul className="m-0 grid list-none gap-2 p-0">
							{habits.quests.map((quest) => (
								<li className="grid gap-0.5" key={quest.id}>
									<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
										<p className="font-medium text-sm">{quest.title}</p>
										<Badge variant={quest.complete ? "default" : "secondary"}>
											{quest.complete ? "Done" : "This week"}
										</Badge>
									</div>
									<p className="text-muted-foreground text-xs">
										{quest.detail}
										{quest.heuristic ? " Heuristic." : ""}
									</p>
								</li>
							))}
						</ul>
					</section>
				</div>
			</div>
		</section>
	);
}
