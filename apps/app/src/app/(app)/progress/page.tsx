import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProgressScreen } from "../../../components/ProgressScreen";
import { withUserDb } from "../../../lib/db/client";
import { PROGRESS_TIMEZONE } from "../../../lib/env";
import { loadHabitsView } from "../../../lib/habits/load";
import { loadProgressView } from "../../../lib/progress/load";
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
	const { habits, view } = await withUserDb(userId, async (db) => {
		const progress = await loadProgressView(db, userId, PROGRESS_TIMEZONE);
		const habitView = await loadHabitsView(db, userId, PROGRESS_TIMEZONE);
		return { habits: habitView, view: progress };
	});
	return <ProgressScreen habits={habits} view={view} />;
}
