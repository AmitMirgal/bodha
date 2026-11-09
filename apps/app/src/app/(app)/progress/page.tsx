import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NavLink } from "../../../components/NavLink";
import { withUserDb } from "../../../lib/db/client";
import { listSessions } from "../../../lib/db/queries";
import { PROGRESS_TIMEZONE } from "../../../lib/env";
import { dayBucket } from "../../../lib/sessions/service";
import { requireUser } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Progress",
};

export default async function ProgressPage() {
	const { userId } = await requireUser();
	if (!userId) {
		redirect("/login?next=/progress");
	}
	const sessions = await withUserDb(userId, (db) => listSessions(db, userId));

	const days = new Map<string, typeof sessions>();
	for (const session of sessions) {
		const stamp =
			session.finished_at ?? session.started_at ?? session.created_at;
		const date = dayBucket(stamp, PROGRESS_TIMEZONE);
		const list = days.get(date) ?? [];
		list.push(session);
		days.set(date, list);
	}

	return (
		<main className="mx-auto grid max-w-3xl gap-4 px-4 py-8">
			<h1 className="font-semibold text-2xl">Progress</h1>
			<p className="text-muted-foreground text-sm">
				Days are bucketed in {PROGRESS_TIMEZONE}. This is a view of completed
				and in-progress sessions, not a score or trend.
			</p>
			{[...days.entries()].length === 0 ? (
				<p>No sessions yet.</p>
			) : (
				[...days.entries()].map(([date, items]) => (
					<Card key={date}>
						<CardHeader>
							<CardTitle>{date}</CardTitle>
						</CardHeader>
						<CardContent>
							<ul className="grid gap-2">
								{items.map((session) => (
									<li key={session.id}>
										<NavLink
											className="underline"
											href={`/session/${session.id}/report`}
										>
											{session.exercise_id}
										</NavLink>{" "}
										· {session.status}
									</li>
								))}
							</ul>
						</CardContent>
					</Card>
				))
			)}
		</main>
	);
}
