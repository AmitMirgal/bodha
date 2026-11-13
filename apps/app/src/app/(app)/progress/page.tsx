import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProgressScreen } from "../../../components/ProgressScreen";
import { withUserDb } from "../../../lib/db/client";
import { PROGRESS_TIMEZONE } from "../../../lib/env";
import { unavailableHabitsView } from "../../../lib/habits/compute";
import { loadHabitsView } from "../../../lib/habits/load";
import { isMissingGamificationSchema } from "../../../lib/habits/schema";
import type { HabitsView } from "../../../lib/habits/types";
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
	const view = await withUserDb(userId, (db) =>
		loadProgressView(db, userId, PROGRESS_TIMEZONE)
	);
	let habits: HabitsView;
	try {
		habits = await withUserDb(userId, (db) =>
			loadHabitsView(db, userId, PROGRESS_TIMEZONE)
		);
	} catch (error) {
		if (!isMissingGamificationSchema(error)) {
			throw error;
		}
		habits = unavailableHabitsView(PROGRESS_TIMEZONE);
	}
	return <ProgressScreen habits={habits} view={view} />;
}
