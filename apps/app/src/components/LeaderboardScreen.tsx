import { Badge } from "@repo/design-system/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import type { LeaderboardView } from "../lib/habits/types";

export function LeaderboardScreen({ view }: { view: LeaderboardView }) {
	return (
		<main className="mx-auto grid max-w-6xl gap-8 px-4 py-10">
			<header className="grid gap-3">
				<p className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
					{"//"} Mati
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
			{view.self ? (
				<Card>
					<CardHeader>
						<CardTitle>Your rank</CardTitle>
						<CardDescription>
							Shown even when you are outside the top {view.topN}.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="font-semibold text-2xl tracking-tight">
							#{view.self.rank} · {view.self.displayName} · {view.self.points}{" "}
							pts
						</p>
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardHeader>
						<CardTitle>You are not on the board</CardTitle>
						<CardDescription>
							The leaderboard is off by default. Opt in from Settings with a
							public display name.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<a
							className="text-sm underline-offset-4 hover:underline"
							href="/settings"
						>
							Open Settings
						</a>
					</CardContent>
				</Card>
			)}
			<Card>
				<CardHeader>
					<CardTitle>This week</CardTitle>
					<CardDescription>
						Rank, display name, points, and badge ids only.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<caption className="sr-only">
								Weekly habit leaderboard for week of {view.weekStartsAt} UTC
							</caption>
							<thead>
								<tr className="border-b text-left">
									<th className="py-2 pr-3">Rank</th>
									<th className="py-2 pr-3">Name</th>
									<th className="py-2 pr-3">Points</th>
									<th className="py-2">Badges</th>
								</tr>
							</thead>
							<tbody>
								{view.rows.length === 0 ? (
									<tr>
										<td className="py-4 text-muted-foreground" colSpan={4}>
											No opted-in ranks this week yet.
										</td>
									</tr>
								) : (
									view.rows.map((row) => (
										<tr
											className={`border-b ${row.isSelf ? "bg-muted/60" : ""}`}
											key={`${row.rank}-${row.displayName}`}
										>
											<td className="py-2 pr-3">{row.rank}</td>
											<td className="py-2 pr-3">
												{row.displayName}
												{row.isSelf ? (
													<span className="text-muted-foreground"> (you)</span>
												) : null}
											</td>
											<td className="py-2 pr-3">{row.points}</td>
											<td className="py-2">
												{row.badgeIds.length > 0
													? row.badgeIds.join(", ")
													: "—"}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</CardContent>
			</Card>
		</main>
	);
}
