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
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/design-system/components/ui/table";
import { Medal, Users } from "lucide-react";
import type { LeaderboardRow, LeaderboardView } from "../lib/habits/types";
import { GamificationMigrationNotice } from "./GamificationMigrationNotice";
import { HabitBadgeRow } from "./HabitBadgeChip";

function RankMarker({ rank }: { rank: number }) {
	switch (rank) {
		case 1:
			return (
				<span className="inline-flex items-center gap-1.5 font-medium tabular-nums">
					<Medal aria-hidden className="size-3.5 text-primary" />
					<span aria-hidden>1</span>
					<span className="sr-only">Rank 1, gold</span>
				</span>
			);
		case 2:
			return (
				<span className="inline-flex items-center gap-1.5 font-medium tabular-nums">
					<Medal aria-hidden className="size-3.5 text-muted-foreground" />
					<span aria-hidden>2</span>
					<span className="sr-only">Rank 2, silver</span>
				</span>
			);
		case 3:
			return (
				<span className="inline-flex items-center gap-1.5 font-medium tabular-nums">
					<Medal aria-hidden className="size-3.5 opacity-70" />
					<span aria-hidden>3</span>
					<span className="sr-only">Rank 3, bronze</span>
				</span>
			);
		default:
			return <span className="tabular-nums">{rank}</span>;
	}
}

function BoardRow({ row }: { row: LeaderboardRow }) {
	return (
		<TableRow className={row.isSelf ? "bg-muted/70" : undefined}>
			<TableCell>
				<RankMarker rank={row.rank} />
			</TableCell>
			<TableCell>
				{row.displayName}
				{row.isSelf ? (
					<Badge className="ml-2" variant="secondary">
						You
					</Badge>
				) : null}
			</TableCell>
			<TableCell className="tabular-nums">{row.points}</TableCell>
			<TableCell>
				<HabitBadgeRow ids={row.badgeIds} />
			</TableCell>
		</TableRow>
	);
}

function RankTable({
	caption,
	rows,
}: {
	caption: string;
	rows: LeaderboardRow[];
}) {
	return (
		<div className="overflow-auto rounded-xl border bg-card">
			<Table>
				<TableCaption className="sr-only">{caption}</TableCaption>
				<TableHeader>
					<TableRow>
						<TableHead>Rank</TableHead>
						<TableHead>Name</TableHead>
						<TableHead>Points</TableHead>
						<TableHead>Badges</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row) => (
						<BoardRow key={`${row.rank}-${row.displayName}`} row={row} />
					))}
				</TableBody>
			</Table>
		</div>
	);
}

export function LeaderboardScreen({ view }: { view: LeaderboardView }) {
	const rows = view.rows.filter((row) => row.rank <= view.topN);
	const pinned = view.self && view.self.rank > view.topN ? view.self : null;
	const emptyBoard = rows.length === 0 && pinned == null;
	return (
		<main className="mx-auto grid max-w-6xl gap-6 px-4 py-10">
			<header className="grid gap-2">
				<p className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
					Weekly habits
				</p>
				<div className="flex flex-wrap items-center gap-2">
					<h1 className="font-semibold text-4xl tracking-tight">Leaderboard</h1>
					{view.exampleData ? (
						<Badge variant="outline">Example data</Badge>
					) : null}
				</div>
				<p className="text-muted-foreground text-sm">
					Weekly habit points from badges, quests, and streak days. Resets
					Monday 00:00 UTC. Only opted-in display names and points are public.
				</p>
			</header>
			{view.migrationRequired ? <GamificationMigrationNotice /> : null}
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
				<div className="grid gap-4">
					<RankTable
						caption={`Weekly habit leaderboard for week of ${view.weekStartsAt} UTC`}
						rows={rows}
					/>
					{pinned ? (
						<div className="grid gap-2">
							<p className="text-muted-foreground text-sm">
								Your rank this week
							</p>
							<RankTable
								caption="Signed-in user rank outside the listed rows"
								rows={[pinned]}
							/>
						</div>
					) : null}
				</div>
			)}
		</main>
	);
}
