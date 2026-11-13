import { Badge } from "@repo/design-system/components/ui/badge";
import type { HabitsView } from "../lib/habits/types";
import { habitBadgeGlyph } from "./HabitBadgeGlyph";
import { StreakGraph } from "./StreakGraph";

function streakWord(count: number): string {
	return count === 1 ? "day" : "days";
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
			<div className="grid gap-6 lg:grid-cols-2">
				<section aria-labelledby="habits-badges" className="grid gap-2">
					<h3 className="font-medium text-sm" id="habits-badges">
						Skill badges
					</h3>
					<ul className="m-0 grid list-none gap-0 divide-y border-y p-0">
						{habits.badges.map((badge) => (
							<li className="flex items-start gap-2 py-2" key={badge.id}>
								<span className="mt-0.5 text-muted-foreground">
									{habitBadgeGlyph(badge.id, "size-3.5")}
								</span>
								<div className="grid min-w-0 flex-1 gap-0.5">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<p className="font-medium text-sm">{badge.title}</p>
										<Badge variant={badge.earned ? "default" : "outline"}>
											{badge.earned ? "Earned" : "Locked"}
										</Badge>
									</div>
									<p className="text-muted-foreground text-xs">
										{badge.description}
										{badge.heuristic ? " Heuristic." : ""}
									</p>
									{badge.href ? (
										<a
											className="text-xs underline-offset-4 hover:underline"
											href={badge.href}
										>
											Open the task that earned this
										</a>
									) : null}
								</div>
							</li>
						))}
					</ul>
				</section>
				<div className="grid gap-4">
					<section aria-labelledby="habits-bests" className="grid gap-2">
						<h3 className="font-medium text-sm" id="habits-bests">
							Personal bests
						</h3>
						<ul className="m-0 grid list-none gap-1 p-0 text-sm">
							{habits.personalBests.map((best) => (
								<li
									className="flex flex-wrap items-baseline justify-between gap-2"
									key={best.label}
								>
									<span className="text-muted-foreground">{best.label}</span>
									<span className="font-medium">{best.value}</span>
								</li>
							))}
						</ul>
					</section>
					<section aria-labelledby="habits-quests" className="grid gap-2">
						<h3 className="font-medium text-sm" id="habits-quests">
							Weekly quests
						</h3>
						<ul className="m-0 grid list-none gap-0 divide-y border-y p-0">
							{habits.quests.map((quest) => (
								<li className="grid gap-0.5 py-2" key={quest.id}>
									<div className="flex flex-wrap items-center justify-between gap-2">
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
