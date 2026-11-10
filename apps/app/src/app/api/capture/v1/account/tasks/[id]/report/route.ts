import { NextResponse } from "next/server";
import { logCaptureRouteError } from "../../../../../../../../lib/capture/log-route-error";
import { assembleEditorLearningReport } from "../../../../../../../../lib/capture/report";
import { withUserDb } from "../../../../../../../../lib/db/client";
import { asInt, isoRequired } from "../../../../../../../../lib/db/rows";
import { requireUser } from "../../../../../../../../lib/supabase/server";

const UUID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
	_request: Request,
	context: { params: Promise<{ id: string }> }
) {
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	const { id } = await context.params;
	if (!UUID.test(id)) {
		return NextResponse.json({ error: "Unknown task." }, { status: 404 });
	}
	try {
		const assembled = await withUserDb(userId, async (db) => {
			const task = await db.captureTask.findFirst({
				include: {
					events: { orderBy: { occurredAt: "asc" } },
					usage: true,
				},
				where: { id, userId },
			});
			if (!task) {
				return null;
			}
			return assembleEditorLearningReport({
				taskId: task.id,
				events: task.events.map((event) => ({
					id: event.id,
					kind: event.kind,
					occurredAt: isoRequired(event.occurredAt),
					payload: event.payload,
				})),
				usage: task.usage.map((row) => ({
					cachedTokens: asInt(row.cachedTokens),
					inputTokens: asInt(row.inputTokens),
					outputTokens: asInt(row.outputTokens),
					provenance: row.provenance,
					reasoningTokens: asInt(row.reasoningTokens),
					source: row.source,
				})),
			});
		});
		if (!assembled) {
			return NextResponse.json({ error: "Unknown task." }, { status: 404 });
		}
		if (!assembled.ok) {
			return NextResponse.json({ error: assembled.error }, { status: 400 });
		}
		return NextResponse.json({ report: assembled.report });
	} catch (error) {
		logCaptureRouteError(
			"GET /api/capture/v1/account/tasks/[id]/report",
			error
		);
		return NextResponse.json(
			{ error: "Could not assemble this editor report." },
			{ status: 500 }
		);
	}
}
