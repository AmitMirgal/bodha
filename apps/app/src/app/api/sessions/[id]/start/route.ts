import { NextResponse } from "next/server";
import { startSession } from "../../../../../lib/sessions/service";
import { requireUser } from "../../../../../lib/supabase/server";

export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const { supabase, userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	try {
		const session = await startSession(supabase, userId, id);
		return NextResponse.json({ session });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Could not start.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
