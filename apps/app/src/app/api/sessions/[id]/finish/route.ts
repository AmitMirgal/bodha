import { NextResponse } from "next/server";
import { z } from "zod";
import { insertOnce } from "../../../../../lib/db/insert-once";
import {
	PersistenceError,
	redactProviderError,
} from "../../../../../lib/errors";
import { operationId } from "../../../../../lib/idempotency";
import {
	LlmConfigError,
	resolveLlmForUser,
} from "../../../../../lib/llm/resolve-config";
import { assembleLearningReport } from "../../../../../lib/reports/assemble";
import { insertUsageRecord } from "../../../../../lib/sessions/service";
import { requireUser } from "../../../../../lib/supabase/server";
import {
	AgentBudgetError,
	MissingToolUseError,
	runReview,
} from "../../../../../mastra/run";

const schema = z.object({
	clientRequestId: z.string().uuid(),
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
	const parsed = schema.safeParse(await request.json().catch(() => ({})));
	const clientRequestId = parsed.success
		? parsed.data.clientRequestId
		: crypto.randomUUID();

	const { data: session, error: sessionError } = await supabase
		.from("sessions")
		.select("*")
		.eq("id", id)
		.eq("user_id", userId)
		.maybeSingle();
	if (sessionError) {
		return NextResponse.json(
			{ error: "Could not load session." },
			{ status: 500 },
		);
	}
	if (!session) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	const { data: existing, error: existingError } = await supabase
		.from("reports")
		.select("*")
		.eq("session_id", id)
		.eq("user_id", userId)
		.order("version", { ascending: false })
		.limit(1)
		.maybeSingle();
	if (existingError) {
		return NextResponse.json(
			{ error: "Could not load reports." },
			{ status: 500 },
		);
	}
	if (existing?.status === "complete") {
		return NextResponse.json({ report: existing, replayed: true });
	}
	if (existing?.status === "running") {
		return NextResponse.json(
			{ error: "A report is already running.", report: existing },
			{ status: 409 },
		);
	}

	const { data: snapshot, error: snapshotError } = await supabase
		.from("exercise_snapshots")
		.select("id")
		.eq("session_id", id)
		.eq("user_id", userId)
		.maybeSingle();
	if (snapshotError) {
		return NextResponse.json(
			{ error: "Could not load snapshot." },
			{ status: 500 },
		);
	}
	if (!snapshot) {
		return NextResponse.json({ error: "Snapshot missing." }, { status: 409 });
	}

	const version = (existing?.version ?? 0) + 1;
	let reportRow: { id: string };
	try {
		const inserted = await insertOnce<{ id: string; status: string }>(
			supabase,
			"reports",
			{
				session_id: id,
				user_id: userId,
				snapshot_id: snapshot.id,
				version,
				status: "running",
			},
			{ session_id: id, version },
			"id, status",
		);
		if (!inserted.created) {
			if (inserted.data.status === "complete") {
				const { data: complete } = await supabase
					.from("reports")
					.select("*")
					.eq("id", inserted.data.id)
					.maybeSingle();
				return NextResponse.json({ report: complete, replayed: true });
			}
			return NextResponse.json(
				{ error: "A report is already running." },
				{ status: 409 },
			);
		}
		reportRow = inserted.data;
	} catch {
		return NextResponse.json(
			{ error: "Could not start report." },
			{ status: 500 },
		);
	}

	const { error: finalizeError } = await supabase
		.from("sessions")
		.update({ status: "finalizing", updated_at: new Date().toISOString() })
		.eq("id", id)
		.eq("user_id", userId);
	if (finalizeError) {
		return NextResponse.json(
			{ error: "Could not finalize session." },
			{ status: 500 },
		);
	}

	try {
		const { config, apiKey } = await resolveLlmForUser(supabase, userId);
		const result = await runReview({
			supabase,
			userId,
			sessionId: id,
			role: "review",
			config,
			apiKey,
			messages: [
				{
					role: "user",
					content:
						"Retrieve this session's snapshot, evidence, and latest test run, then return the JSON learning report fields summary, suggestions, and insufficientEvidence.",
				},
			],
		});

		await insertUsageRecord(supabase, {
			sessionId: id,
			userId,
			operationId: operationId(["review", id, clientRequestId]),
			agentRole: "review",
			usage: result.usage,
		});

		const { data: evidence, error: evidenceError } = await supabase
			.from("evidence_events")
			.select("id, kind, session_id, payload")
			.eq("session_id", id)
			.eq("user_id", userId)
			.order("seq", { ascending: true });
		if (evidenceError) {
			throw new PersistenceError("Could not load evidence for the report.");
		}
		const { data: usageRows, error: usageError } = await supabase
			.from("usage_records")
			.select(
				"agent_role, input_tokens, output_tokens, cached_tokens, cached_included_in_input, coverage, native",
			)
			.eq("session_id", id)
			.eq("user_id", userId);
		if (usageError) {
			throw new PersistenceError("Could not load usage records.");
		}

		const assembled = assembleLearningReport({
			model: result.model,
			evidence: (evidence ?? []).map((row) => ({
				id: row.id,
				kind: row.kind,
				sessionId: row.session_id,
				payload: row.payload,
			})),
			usageRows: usageRows ?? [],
			sessionId: id,
		});
		if (!assembled.ok) {
			throw new Error(assembled.error);
		}

		const { data: complete, error: completeError } = await supabase
			.from("reports")
			.update({
				status: "complete",
				body: assembled.report,
				error: null,
			})
			.eq("id", reportRow.id)
			.eq("user_id", userId)
			.select("*")
			.single();
		if (completeError || !complete) {
			throw new PersistenceError("Could not store the completed report.");
		}

		const { error: sessionCompleteError } = await supabase
			.from("sessions")
			.update({
				status: "complete",
				finished_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			})
			.eq("id", id)
			.eq("user_id", userId);
		if (sessionCompleteError) {
			throw new PersistenceError("Could not mark the session complete.");
		}

		return NextResponse.json({
			report: complete,
			usage: assembled.report.usage,
			source: config.source,
		});
	} catch (error) {
		const message = redactProviderError(error);
		const incomplete =
			error instanceof MissingToolUseError || error instanceof AgentBudgetError;
		await supabase
			.from("reports")
			.update({
				status: incomplete ? "incomplete" : "failed",
				error: message,
			})
			.eq("id", reportRow.id)
			.eq("user_id", userId);
		await supabase
			.from("sessions")
			.update({
				status: "failed",
				updated_at: new Date().toISOString(),
			})
			.eq("id", id)
			.eq("user_id", userId);
		const status =
			error instanceof LlmConfigError
				? 400
				: error instanceof PersistenceError
					? 500
					: 500;
		return NextResponse.json(
			{ error: message, incomplete, evidencePreserved: true },
			{ status },
		);
	}
}
