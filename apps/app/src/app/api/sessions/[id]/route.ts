import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/supabase/server";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const { supabase, userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	const { data: session, error } = await supabase
		.from("sessions")
		.select("*")
		.eq("id", id)
		.eq("user_id", userId)
		.maybeSingle();
	if (error || !session) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}
	const { data: snapshot } = await supabase
		.from("exercise_snapshots")
		.select("id, content_hash, exercise_id, meta, created_at")
		.eq("session_id", id)
		.eq("user_id", userId)
		.maybeSingle();
	return NextResponse.json({ session, snapshot });
}
