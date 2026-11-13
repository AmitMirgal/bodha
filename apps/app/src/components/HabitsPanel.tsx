import { Badge } from "@repo/design-system/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { CalendarRange, Flame, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import type { HabitsView } from "../lib/habits/types";
import { habitBadgeGlyph } from "./HabitBadgeGlyph";

function HabitKpiCard({
	badge,
	color,
	detail,
	icon,
	title,
	value,
}: {
	badge: string;
	color: string;
	detail: string;
	icon: ReactNode;
	title: string;
	value: ReactNode;
}) {
	return (
		<Card className="overflow-hidden py-0 shadow-sm">
			<CardHeader className="gap-4 pt-6">
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-center gap-2.5">
						<span
							className="flex size-9 items-center justify-center rounded-lg"
							style={{
								background: `color-mix(in oklch, ${color} 16%, transparent)`,
								color,
							}}
						>
							{icon}
						</span>
						<CardTitle className="font-medium text-sm">{title}</CardTitle>
					</div>
					<Badge variant="outline">{badge}</Badge>
				</div>
				<p className="font-semibold text-3xl tabular-nums tracking-tight">
					{value}
				</p>
				<CardDescription>{detail}</CardDescription>
			</CardHeader>
			<div className="h-4" />
		</Card>
	);
}

export function HabitsPanel({ habits }: { habits: HabitsView }) {
	return (
		<section aria-labelledby="habits-heading" className="grid gap-6">
			<div className="grid gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<h2
						className="font-semibold text-lg tracking-tight"
						id="habits-heading"
					>
						Habits
					</h2>
					{habits.exampleData ? (
						<Badge variant="outline">Example data</Badge>
					) : null}
				</div>
				<p className="max-w-3xl text-muted-foreground text-sm">
					Streak days use {habits.timezone}. A day counts when you open the
					report for a completed captured editor task. Missed days break the run
					— there is no streak freeze. Points come from badges, quests, and
					streak days only (daily cap {habits.dailyCap}). Weekly totals reset
					Monday 00:00 UTC.
				</p>
			</div>
			<div className="grid gap-3 sm:grid-cols-3">
				<HabitKpiCard
					badge="Observed"
					color="var(--chart-1)"
					detail="Consecutive qualifying days. Missed days break the run."
					icon={<Flame aria-hidden className="size-4" />}
					title="Current streak"
					value={
						<>
							{habits.currentStreak}{" "}
							<span className="font-medium text-base text-muted-foreground">
								{habits.currentStreak === 1 ? "day" : "days"}
							</span>
						</>
					}
				/>
				<HabitKpiCard
					badge="Observed"
					color="var(--chart-2)"
					detail="Longest qualifying run so far."
					icon={<Trophy aria-hidden className="size-4" />}
					title="Best streak"
					value={
						<>
							{habits.bestStreak}{" "}
							<span className="font-medium text-base text-muted-foreground">
								{habits.bestStreak === 1 ? "day" : "days"}
							</span>
						</>
					}
				/>
				<HabitKpiCard
					badge="UTC"
					color="var(--chart-4)"
					detail={`Week of ${habits.weekStartsAt} UTC. Daily cap ${habits.dailyCap}.`}
					icon={<CalendarRange aria-hidden className="size-4" />}
					title="This week"
					value={
						<>
							{habits.weekPoints}{" "}
							<span className="font-medium text-base text-muted-foreground">
								pts
							</span>
						</>
					}
				/>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Last 28 days</CardTitle>
					<CardDescription>
						Each square is a day. Filled squares are days you opened a completed
						captured-task report.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ol
						aria-label="Streak calendar of the last 28 days"
						className="m-0 grid max-w-xs list-none grid-cols-7 gap-1.5 p-0"
					>
						{habits.calendar.map((day) => {
							const label = day.qualified
								? `${day.date}, completed captured-task report opened`
								: `${day.date}, no qualifying report`;
							return (
								<li key={day.date}>
									<span className="sr-only">{label}</span>
									<span
										aria-hidden
										className={`block aspect-square rounded-sm border ${
											day.qualified
												? "border-primary bg-primary"
												: "border-border bg-muted"
										}`}
										title={day.date}
									/>
								</li>
							);
						})}
					</ol>
				</CardContent>
			</Card>
			<div className="grid gap-4 lg:grid-cols-2">
				<section aria-labelledby="habits-badges" className="grid gap-3">
					<h3 className="font-semibold text-base" id="habits-badges">
						Skill badges
					</h3>
					<div className="grid gap-3">
						{habits.badges.map((badge) => (
							<Card key={badge.id}>
								<CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
									<div className="flex items-center gap-2">
										{habitBadgeGlyph(badge.id)}
										<CardTitle className="text-base">{badge.title}</CardTitle>
									</div>
									<Badge variant={badge.earned ? "default" : "outline"}>
										{badge.earned ? "Earned" : "Locked"}
									</Badge>
								</CardHeader>
								<CardContent className="grid gap-2">
									<p className="text-muted-foreground text-sm">
										{badge.description}
										{badge.heuristic ? " Heuristic." : ""}
									</p>
									{badge.href ? (
										<a
											className="text-sm underline-offset-4 hover:underline"
											href={badge.href}
										>
											Open the task that earned this
										</a>
									) : null}
								</CardContent>
							</Card>
						))}
					</div>
				</section>
				<div className="grid gap-6">
					<section aria-labelledby="habits-bests" className="grid gap-3">
						<h3 className="font-semibold text-base" id="habits-bests">
							Personal bests
						</h3>
						{habits.personalBests.map((best) => (
							<Card key={best.label}>
								<CardHeader>
									<CardTitle className="text-base">{best.label}</CardTitle>
								</CardHeader>
								<CardContent className="grid gap-2">
									<p className="font-medium">{best.value}</p>
									{best.href ? (
										<a
											className="text-sm underline-offset-4 hover:underline"
											href={best.href}
										>
											Open that task
										</a>
									) : null}
								</CardContent>
							</Card>
						))}
					</section>
					<section aria-labelledby="habits-quests" className="grid gap-3">
						<h3 className="font-semibold text-base" id="habits-quests">
							Weekly quests
						</h3>
						{habits.quests.map((quest) => (
							<Card key={quest.id}>
								<CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
									<CardTitle className="text-base">{quest.title}</CardTitle>
									<Badge variant={quest.complete ? "default" : "secondary"}>
										{quest.complete ? "Done" : "This week"}
									</Badge>
								</CardHeader>
								<CardContent>
									<p className="text-muted-foreground text-sm">
										{quest.detail}
										{quest.heuristic ? " Heuristic." : ""}
									</p>
								</CardContent>
							</Card>
						))}
					</section>
				</div>
			</div>
		</section>
	);
}
