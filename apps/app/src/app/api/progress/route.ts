import { NextResponse } from "next/server";
import { withUserDb } from "../../../lib/db/client";
import { listSessions } from "../../../lib/db/queries";
import { PROGRESS_TIMEZONE } from "../../../lib/env";
import { dayBucket } from "../../../lib/sessions/service";
import { requireUser } from "../../../lib/supabase/server";

export async function GET() {
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	try {
		const data = await withUserDb(userId, (db) => listSessions(db, userId));
		const days = new Map<string, { date: string; sessions: typeof data }>();
		for (const session of data) {
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
	} catch {
		return NextResponse.json(
			{ error: "Could not load progress." },
			{ status: 500 }
		);
	}
}
