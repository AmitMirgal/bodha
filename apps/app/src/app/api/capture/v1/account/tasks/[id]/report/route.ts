import { NextResponse } from "next/server";
import { generateCaptureTaskReport } from "../../../../../../../../lib/capture/generate-report";
import { logCaptureRouteError } from "../../../../../../../../lib/capture/log-route-error";
import { assembleEditorLearningReport } from "../../../../../../../../lib/capture/report";
import {
	runtimeRunWithDb,
	withUserDb,
} from "../../../../../../../../lib/db/client";
import { asInt, isoRequired } from "../../../../../../../../lib/db/rows";
import { redactProviderError } from "../../../../../../../../lib/errors";
import {
	LlmConfigError,
	resolveLlmForUser,
} from "../../../../../../../../lib/llm/resolve-config";
import { requireUser } from "../../../../../../../../lib/supabase/server";
import { runCaptureReview } from "../../../../../../../../mastra/run";

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
		const loaded = await withUserDb(userId, async (db) => {
			const task = await db.captureTask.findFirst({
				include: {
					events: { orderBy: { occurredAt: "asc" } },
					reports: { orderBy: { version: "desc" }, take: 1 },
					usage: true,
				},
				where: { id, userId },
			});
			if (!task) {
				return null;
			}
			const events = task.events.map((event) => ({
				id: event.id,
				kind: event.kind,
				occurredAt: isoRequired(event.occurredAt),
				payload: event.payload,
			}));
			const usage = task.usage.map((row) => ({
				cachedTokens: asInt(row.cachedTokens),
				inputTokens: asInt(row.inputTokens),
				outputTokens: asInt(row.outputTokens),
				provenance: row.provenance,
				reasoningTokens: asInt(row.reasoningTokens),
				source: row.source,
			}));
			const stored = task.reports[0] ?? null;
			const assembled = assembleEditorLearningReport({
				events,
				taskId: task.id,
				usage,
			});
			return { assembled, stored };
		});
		if (!loaded) {
			return NextResponse.json({ error: "Unknown task." }, { status: 404 });
		}
		if (!loaded.assembled.ok) {
			return NextResponse.json(
				{ error: loaded.assembled.error },
				{ status: 400 }
			);
		}
		const storedBody =
			loaded.stored?.status === "complete" ? loaded.stored.body : null;
		return NextResponse.json({
			report: storedBody ?? loaded.assembled.report,
			stored: loaded.stored
				? {
						error: loaded.stored.error,
						status: loaded.stored.status,
						version: loaded.stored.version,
					}
				: null,
		});
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

export async function POST(
	request: Request,
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
	let force = false;
	try {
		const body = (await request.json().catch(() => ({}))) as {
			force?: unknown;
		};
		force = body.force === true;
	} catch {
		force = false;
	}
	try {
		const generated = await withUserDb(userId, (db) =>
			generateCaptureTaskReport(db, userId, id, {
				deps: {
					resolveLlm: async (inner, uid) => resolveLlmForUser(inner, uid),
					review: async ({ taskId }) => {
						const { apiKey, config } = await withUserDb(userId, (inner) =>
							resolveLlmForUser(inner, userId)
						);
						const result = await runCaptureReview({
							apiKey,
							config,
							messages: [
								{
									content:
										"Retrieve this editor task's captured evidence and return the JSON learning report fields summary, suggestions, and insufficientEvidence.",
									role: "user",
								},
							],
							role: "review",
							runWithDb: runtimeRunWithDb(),
							sessionId: taskId,
							userId,
						});
						return result.model;
					},
				},
				force,
			})
		);
		return NextResponse.json({
			error: generated.error,
			kind: generated.kind,
			needsKey: generated.kind === "facts_only",
			report: generated.body,
			status: generated.status,
		});
	} catch (error) {
		logCaptureRouteError(
			"POST /api/capture/v1/account/tasks/[id]/report",
			error
		);
		return NextResponse.json(
			{ error: redactProviderError(error) },
			{ status: error instanceof LlmConfigError ? 400 : 500 }
		);
	}
}
