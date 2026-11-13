"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/design-system/components/ui/table";
import { CalendarRange, Medal, Trophy, Users } from "lucide-react";
import type { ReactNode } from "react";
import type { LeaderboardRow, LeaderboardView } from "../lib/habits/types";
import { HabitBadgeRow } from "./HabitBadgeChip";

function KpiCard({
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
	value: string;
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

function podiumLabel(rank: number): string {
	switch (rank) {
		case 1:
			return "1st";
		case 2:
			return "2nd";
		case 3:
			return "3rd";
		default:
			return `#${rank}`;
	}
}

function podiumCardClass(row: LeaderboardRow): string {
	if (row.isSelf) {
		return "border-primary shadow-sm ring-2 ring-primary/40";
	}
	if (row.rank === 1) {
		return "border-primary/40 shadow-sm";
	}
	return "shadow-sm";
}

function PodiumCard({ row }: { row: LeaderboardRow }) {
	const first = row.rank === 1;
	return (
		<Card className={podiumCardClass(row)}>
			<CardHeader className="gap-3">
				<div className="flex items-start justify-between gap-2">
					<span
						className={`flex size-10 items-center justify-center rounded-lg font-semibold tabular-nums ${
							first
								? "bg-primary text-primary-foreground"
								: "bg-secondary text-secondary-foreground"
						}`}
					>
						{row.rank}
					</span>
					<div className="flex flex-wrap gap-1">
						<Badge variant={first ? "default" : "outline"}>
							{podiumLabel(row.rank)}
						</Badge>
						{row.isSelf ? <Badge variant="secondary">You</Badge> : null}
					</div>
				</div>
				<CardTitle className="text-xl tracking-tight">
					{row.displayName}
				</CardTitle>
				<p className="font-semibold text-3xl tabular-nums tracking-tight">
					{row.points}{" "}
					<span className="font-medium text-base text-muted-foreground">
						pts
					</span>
				</p>
			</CardHeader>
			<CardContent>
				<HabitBadgeRow ids={row.badgeIds} />
			</CardContent>
		</Card>
	);
}

export function LeaderboardScreen({ view }: { view: LeaderboardView }) {
	const podium = view.rows.filter((row) => row.rank <= 3).slice(0, 3);
	const rest = view.rows.filter((row) => row.rank > 3);
	const emptyBoard = view.rows.length === 0;
	return (
		<main className="mx-auto grid max-w-6xl gap-10 px-4 py-10">
			<header className="grid gap-3">
				<p className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
					Weekly habits
				</p>
				<div className="flex flex-wrap items-center gap-2">
					<h1 className="font-semibold text-4xl tracking-tight">Leaderboard</h1>
					{view.exampleData ? (
						<Badge variant="outline">Example data</Badge>
					) : null}
				</div>
				<p className="max-w-3xl text-muted-foreground">
					Weekly habit points from badges, quests, and streak days. Resets
					Monday 00:00 UTC (week of {view.weekStartsAt}). Never ranked by
					tokens, prompt count, time spent, or cost. Only opted-in display names
					and points are public.
				</p>
			</header>
			<section
				aria-label="Your standing"
				className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
			>
				<KpiCard
					badge={view.self ? "You" : "Off"}
					color="var(--chart-1)"
					detail={
						view.self
							? `Shown even when you are outside the top ${view.topN}.`
							: "Opt in from Settings to get a public rank."
					}
					icon={<Trophy aria-hidden className="size-4" />}
					title="Your rank"
					value={view.self ? `#${view.self.rank}` : "—"}
				/>
				<KpiCard
					badge="This week"
					color="var(--chart-2)"
					detail="Habit points from badges, quests, and streak days. Daily cap applies."
					icon={<Medal aria-hidden className="size-4" />}
					title="Your points"
					value={view.self ? String(view.self.points) : "—"}
				/>
				<KpiCard
					badge="UTC"
					color="var(--chart-4)"
					detail={`${view.rows.length} opted-in ${view.rows.length === 1 ? "name" : "names"} this week.`}
					icon={<CalendarRange aria-hidden className="size-4" />}
					title="Week of"
					value={view.weekStartsAt}
				/>
			</section>
			{view.optedIn ? null : (
				<Card className="border-dashed">
					<CardHeader>
						<CardTitle>Join this week's board</CardTitle>
						<CardDescription>
							The leaderboard is off by default. Choose a public display name in
							Settings. Opting out removes you immediately.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button asChild>
							<a href="/settings">Opt in from Settings</a>
						</Button>
					</CardContent>
				</Card>
			)}
			{emptyBoard ? (
				<Empty className="border border-dashed">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Users />
						</EmptyMedia>
						<EmptyTitle>Nobody has opted in this week</EmptyTitle>
						<EmptyDescription>
							The board stays empty until someone opts in from Settings. Names
							and habit points are the only public fields.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : (
				<>
					<section aria-labelledby="leaderboard-top" className="grid gap-4">
						<h2
							className="font-semibold text-lg tracking-tight"
							id="leaderboard-top"
						>
							Top 3
						</h2>
						<div className="grid gap-4 lg:grid-cols-3">
							{podium.map((row) => (
								<PodiumCard key={`${row.rank}-${row.displayName}`} row={row} />
							))}
						</div>
					</section>
					{rest.length > 0 ? (
						<section aria-labelledby="leaderboard-rest" className="grid gap-4">
							<h2
								className="font-semibold text-lg tracking-tight"
								id="leaderboard-rest"
							>
								This week
							</h2>
							<div className="overflow-auto rounded-xl border bg-card shadow-sm">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Rank</TableHead>
											<TableHead>Name</TableHead>
											<TableHead>Points</TableHead>
											<TableHead>Badges</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{rest.map((row) => (
											<TableRow
												className={row.isSelf ? "bg-muted/70" : undefined}
												key={`${row.rank}-${row.displayName}`}
											>
												<TableCell className="font-medium tabular-nums">
													{row.rank}
												</TableCell>
												<TableCell>
													{row.displayName}
													{row.isSelf ? (
														<Badge className="ml-2" variant="secondary">
															You
														</Badge>
													) : null}
												</TableCell>
												<TableCell className="tabular-nums">
													{row.points}
												</TableCell>
												<TableCell>
													<HabitBadgeRow ids={row.badgeIds} />
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</section>
					) : null}
				</>
			)}
		</main>
	);
}
