import { NextResponse } from "next/server";
import { z } from "zod";
import { withUserDb } from "../../../../../lib/db/client";
import { RevisionConflictError } from "../../../../../lib/errors";
import { saveFiles } from "../../../../../lib/sessions/service";
import { requireUser } from "../../../../../lib/supabase/server";

const schema = z.object({
	files: z
		.record(z.string(), z.string().max(200_000))
		.refine((files) => Object.keys(files).length <= 40, "Too many files."),
	expectedUpdatedAt: z.string().min(1).optional(),
});

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	const parsed = schema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid files payload." },
			{ status: 400 }
		);
	}
	try {
		const saved = await withUserDb(userId, (db) =>
			saveFiles(
				db,
				userId,
				id,
				parsed.data.files,
				parsed.data.expectedUpdatedAt
			)
		);
		return NextResponse.json({ saved });
	} catch (error) {
		if (error instanceof RevisionConflictError) {
			return NextResponse.json(
				{ error: error.message, code: "revision_conflict" },
				{ status: 409 }
			);
		}
		const message = error instanceof Error ? error.message : "Save failed.";
		return NextResponse.json({ error: message }, { status: 409 });
	}
}
