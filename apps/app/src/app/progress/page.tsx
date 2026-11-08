import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav } from "../../components/AppNav";
import { PROGRESS_TIMEZONE } from "../../lib/env";
import { dayBucket } from "../../lib/sessions/service";
import { requireUser } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
	const { supabase, userId } = await requireUser();
	if (!userId) {
		redirect("/login?next=/progress");
	}
	const { data: user } = await supabase.auth.getUser();
	const { data: sessions } = await supabase
		.from("sessions")
		.select("id, exercise_id, status, started_at, finished_at, created_at")
		.eq("user_id", userId)
		.order("created_at", { ascending: false });

	const days = new Map<string, NonNullable<typeof sessions>>();
	for (const session of sessions ?? []) {
		const stamp =
			session.finished_at ?? session.started_at ?? session.created_at;
		const date = dayBucket(stamp, PROGRESS_TIMEZONE);
		const list = days.get(date) ?? [];
		list.push(session);
		days.set(date, list);
	}

	return (
		<>
			<AppNav email={user.user?.email} />
			<main className="mx-auto grid max-w-3xl gap-4 px-4 py-8">
				<h1 className="font-semibold text-2xl">Daily progress</h1>
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
											<Link
												className="underline"
												href={`/session/${session.id}/report`}
											>
												{session.exercise_id}
											</Link>{" "}
											· {session.status}
										</li>
									))}
								</ul>
							</CardContent>
						</Card>
					))
				)}
			</main>
		</>
	);
}
