import { NextResponse } from "next/server";
import { withUserDb } from "../../../lib/db/client";
import { PROGRESS_TIMEZONE } from "../../../lib/env";
import { loadProgressView } from "../../../lib/progress/load";
import { requireUser } from "../../../lib/supabase/server";

export async function GET() {
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	try {
		const view = await withUserDb(userId, (db) =>
			loadProgressView(db, userId, PROGRESS_TIMEZONE)
		);
		return NextResponse.json(view);
	} catch {
		return NextResponse.json(
			{ error: "Could not load progress." },
			{ status: 500 }
		);
	}
}
