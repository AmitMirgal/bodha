import { NextResponse } from "next/server";
import { withUserDb } from "../../../../../lib/db/client";
import { listReports } from "../../../../../lib/db/queries";
import { requireUser } from "../../../../../lib/supabase/server";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	try {
		const reports = await withUserDb(userId, (db) => listReports(db, id));
		return NextResponse.json({ reports });
	} catch {
		return NextResponse.json(
			{ error: "Could not load reports." },
			{ status: 500 }
		);
	}
}
