import { NextResponse } from "next/server";
import { PROGRESS_TIMEZONE } from "../../../lib/env";
import { dayBucket } from "../../../lib/sessions/service";
import { requireUser } from "../../../lib/supabase/server";

export async function GET() {
	const { supabase, userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	const { data, error } = await supabase
		.from("sessions")
		.select("id, exercise_id, status, started_at, finished_at, created_at")
		.eq("user_id", userId)
		.order("created_at", { ascending: false });
	if (error) {
		return NextResponse.json(
			{ error: "Could not load progress." },
			{ status: 500 },
		);
	}
	const days = new Map<string, { date: string; sessions: typeof data }>();
	for (const session of data ?? []) {
		const stamp =
			session.finished_at ?? session.started_at ?? session.created_at;
		const date = dayBucket(stamp, PROGRESS_TIMEZONE);
		const current = days.get(date) ?? { date, sessions: [] };
		current.sessions.push(session);
		days.set(date, current);
	}
	return NextResponse.json({
		timezone: PROGRESS_TIMEZONE,
		days: [...days.values()],
	});
}
