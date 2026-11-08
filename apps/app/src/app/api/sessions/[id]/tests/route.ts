import { NextResponse } from "next/server";
import { z } from "zod";
import { RevisionConflictError } from "../../../../../lib/errors";
import { recordTestRun } from "../../../../../lib/sessions/service";
import { requireUser } from "../../../../../lib/supabase/server";

const schema = z.object({
	files: z.record(z.string(), z.string()),
	results: z.array(
		z.object({
			task: z.string(),
			name: z.string(),
			pass: z.boolean(),
			error: z.string().optional(),
			ms: z.number(),
		}),
	),
	fatal: z.string().optional(),
	expectedUpdatedAt: z.string().min(1).optional(),
});

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const { supabase, userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	const parsed = schema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid test payload." },
			{ status: 400 },
		);
	}
	try {
		const run = await recordTestRun(supabase, {
			userId,
			sessionId: id,
			results: parsed.data.results,
			fatal: parsed.data.fatal,
			files: parsed.data.files,
			expectedUpdatedAt: parsed.data.expectedUpdatedAt,
		});
		return NextResponse.json({
			run: {
				id: run.id,
				savedAt: run.savedAt,
				provenance: "browser_harness",
				note: "Browser-observed results, not independent server verification.",
			},
		});
	} catch (error) {
		if (error instanceof RevisionConflictError) {
			return NextResponse.json(
				{ error: error.message, code: "revision_conflict" },
				{ status: 409 },
			);
		}
		const message =
			error instanceof Error ? error.message : "Could not store test run.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
