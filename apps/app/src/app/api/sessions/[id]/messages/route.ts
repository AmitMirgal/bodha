import { NextResponse } from "next/server";
import { withUserDb } from "../../../../../lib/db/client";
import { listMessages } from "../../../../../lib/db/queries";
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
		const messages = await withUserDb(userId, (db) => listMessages(db, id));
		return NextResponse.json({ messages });
	} catch {
		return NextResponse.json(
			{ error: "Could not load messages." },
			{ status: 500 }
		);
	}
}
