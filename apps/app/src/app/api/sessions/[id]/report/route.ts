import { NextResponse } from "next/server";
import { requireUser } from "../../../../../lib/supabase/server";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const { supabase, userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	const { data, error } = await supabase
		.from("reports")
		.select("id, version, status, body, error, created_at, session_id")
		.eq("session_id", id)
		.eq("user_id", userId)
		.order("version", { ascending: false });
	if (error) {
		return NextResponse.json(
			{ error: "Could not load reports." },
			{ status: 500 },
		);
	}
	return NextResponse.json({ reports: data ?? [] });
}
