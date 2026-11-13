import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LeaderboardScreen } from "../../../components/LeaderboardScreen";
import { withUserDb } from "../../../lib/db/client";
import { PROGRESS_TIMEZONE } from "../../../lib/env";
import { loadLeaderboardView } from "../../../lib/habits/load";
import { requireUser } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Leaderboard",
};

export default async function LeaderboardPage() {
	const { userId } = await requireUser();
	if (!userId) {
		redirect("/login?next=/leaderboard");
	}
	const view = await withUserDb(userId, (db) =>
		loadLeaderboardView(db, userId, PROGRESS_TIMEZONE)
	);
	return <LeaderboardScreen view={view} />;
}
