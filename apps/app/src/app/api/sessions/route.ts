import { NextResponse } from "next/server";
import { z } from "zod";
import { withUserDb } from "../../../lib/db/client";
import { listSessions } from "../../../lib/db/queries";
import { createSession } from "../../../lib/sessions/service";
import { requireUser } from "../../../lib/supabase/server";

const createSchema = z.object({
	exerciseId: z.string().regex(/^[a-z0-9-]+$/),
});

export async function GET() {
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	try {
		const sessions = await withUserDb(userId, (db) => listSessions(db, userId));
		return NextResponse.json({ sessions });
	} catch {
		return NextResponse.json(
			{ error: "Could not list sessions." },
			{ status: 500 }
		);
	}
}

export async function POST(request: Request) {
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	const parsed = createSchema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid exercise." }, { status: 400 });
	}
	try {
		const session = await withUserDb(userId, (db) =>
			createSession(db, userId, parsed.data.exerciseId)
		);
		return NextResponse.json({ session });
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Could not create session.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
