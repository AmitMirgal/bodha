import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "../../../lib/sessions/service";
import { requireUser } from "../../../lib/supabase/server";

const createSchema = z.object({
	exerciseId: z.string().regex(/^[a-z0-9-]+$/),
});

export async function GET() {
	const { supabase, userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	const { data, error } = await supabase
		.from("sessions")
		.select("id, exercise_id, status, started_at, finished_at, updated_at")
		.eq("user_id", userId)
		.order("created_at", { ascending: false });
	if (error) {
		return NextResponse.json(
			{ error: "Could not list sessions." },
			{ status: 500 },
		);
	}
	return NextResponse.json({ sessions: data ?? [] });
}

export async function POST(request: Request) {
	const { supabase, userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	const parsed = createSchema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid exercise." }, { status: 400 });
	}
	try {
		const session = await createSession(
			supabase,
			userId,
			parsed.data.exerciseId,
		);
		return NextResponse.json({ session });
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Could not create session.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
