import { NextResponse } from "next/server";
import { z } from "zod";
import { operationId } from "../../../../../lib/idempotency";
import {
	LlmConfigError,
	resolveLlmForUser,
} from "../../../../../lib/llm/resolve-config";
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

	const { data: session } = await supabase
		.from("sessions")
		.select("*")
		.eq("id", id)
		.eq("user_id", userId)
		.maybeSingle();
	if (!session) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	const { data: existing } = await supabase
		.from("reports")
		.select("*")
		.eq("session_id", id)
		.eq("user_id", userId)
		.order("version", { ascending: false })
		.limit(1)
		.maybeSingle();
	if (existing?.status === "complete") {
		return NextResponse.json({ report: existing, replayed: true });
	}
	if (existing?.status === "running") {
		return NextResponse.json(
			{ error: "A report is already running.", report: existing },
			{ status: 409 },
		);
	}

	const { data: snapshot } = await supabase
		.from("exercise_snapshots")
		.select("id")
		.eq("session_id", id)
		.eq("user_id", userId)
		.maybeSingle();
	if (!snapshot) {
		return NextResponse.json({ error: "Snapshot missing." }, { status: 409 });
	}

	await supabase
		.from("sessions")
		.update({ status: "finalizing", updated_at: new Date().toISOString() })
		.eq("id", id)
		.eq("user_id", userId);

	const { data: reportRow, error: reportError } = await supabase
		.from("reports")
		.insert({
			session_id: id,
			user_id: userId,
			snapshot_id: snapshot.id,
			version: (existing?.version ?? 0) + 1,
			status: "running",
		})
		.select("*")
		.single();
	if (reportError || !reportRow) {
		return NextResponse.json(
			{ error: "Could not start report." },
			{ status: 500 },
		);
	}

	try {
		const { config, apiKey } = await resolveLlmForUser(supabase, userId);
		const { data: evidence } = await supabase
			.from("evidence_events")
			.select("id, kind, session_id")
			.eq("session_id", id)
			.eq("user_id", userId);
		const result = await runReview({
			supabase,
			userId,
			sessionId: id,
			role: "review",
			config,
			apiKey,
			evidence: (evidence ?? []).map((row) => ({
				id: row.id,
				kind: row.kind,
				sessionId: row.session_id,
			})),
			messages: [
				{
					role: "user",
					content:
						"Retrieve this session's snapshot, evidence, and latest test run, then return the JSON learning report.",
				},
			],
		});

		await supabase.from("usage_records").upsert(
			{
				session_id: id,
				user_id: userId,
				operation_id: operationId(["review", id, clientRequestId]),
				agent_role: "review",
				input_tokens: result.usage.inputTokens,
				output_tokens: result.usage.outputTokens,
				cached_tokens: result.usage.cachedTokens,
				cached_included_in_input: result.usage.cachedIncludedInInput,
				coverage: result.usage.coverage,
				native: result.usage.native,
			},
			{ onConflict: "session_id,operation_id" },
		);

		const { data: complete } = await supabase
			.from("reports")
			.update({
				status: "complete",
				body: result.report,
				error: null,
			})
			.eq("id", reportRow.id)
			.eq("user_id", userId)
			.select("*")
			.single();

		await supabase
			.from("sessions")
			.update({
				status: "complete",
				finished_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			})
			.eq("id", id)
			.eq("user_id", userId);

		return NextResponse.json({
			report: complete,
			usage: result.usage,
			source: config.source,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Review failed.";
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
		const status = error instanceof LlmConfigError ? 400 : 500;
		return NextResponse.json(
			{ error: message, incomplete, evidencePreserved: true },
			{ status },
		);
	}
}
