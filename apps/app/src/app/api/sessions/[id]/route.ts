import { NextResponse } from "next/server";
import { withUserDb } from "../../../../lib/db/client";
import { getSession, getSnapshotSummary } from "../../../../lib/db/queries";
import { requireUser } from "../../../../lib/supabase/server";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	const session = await withUserDb(userId, (db) => getSession(db, id));
	if (!session) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}
	const snapshot = await withUserDb(userId, (db) => getSnapshotSummary(db, id));
	return NextResponse.json({ session, snapshot });
}
