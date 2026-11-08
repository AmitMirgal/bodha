import { NextResponse } from "next/server";
import { z } from "zod";
import { newIdempotencyKey, operationId } from "../../../../../lib/idempotency";
import {
	LlmConfigError,
	resolveLlmForUser,
} from "../../../../../lib/llm/resolve-config";
import { insertEvidence } from "../../../../../lib/sessions/service";
import { requireUser } from "../../../../../lib/supabase/server";
import {
	AgentBudgetError,
	asChatTurn,
	MissingToolUseError,
	runTrainer,
} from "../../../../../mastra/run";

const schema = z.object({
	message: z.string().min(1).max(4000),
	clientRequestId: z.string().uuid(),
});

const rate = new Map<string, { count: number; reset: number }>();

function rateLimit(userId: string) {
	const now = Date.now();
	const current = rate.get(userId);
	if (!current || current.reset < now) {
		rate.set(userId, { count: 1, reset: now + 60_000 });
		return true;
	}
	if (current.count >= 20) {
		return false;
	}
	current.count += 1;
	return true;
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const { supabase, userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	if (!rateLimit(userId)) {
		return NextResponse.json({ error: "Too many requests." }, { status: 429 });
	}
	const parsed = schema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid message." }, { status: 400 });
	}

	const { data: session } = await supabase
		.from("sessions")
		.select("id, status")
		.eq("id", id)
		.eq("user_id", userId)
		.maybeSingle();
	if (!session || session.status !== "running") {
		return NextResponse.json(
			{ error: "Session is not running." },
			{ status: 409 },
		);
	}

	const idempotencyKey = operationId(["chat", id, parsed.data.clientRequestId]);
	const { data: existing } = await supabase
		.from("evidence_events")
		.select("id")
		.eq("session_id", id)
		.eq("idempotency_key", `${idempotencyKey}:assistant`)
		.maybeSingle();
	if (existing) {
		return NextResponse.json({
			replayed: true,
			error: "This chat turn was already recorded.",
		});
	}

	try {
		const { config, apiKey } = await resolveLlmForUser(supabase, userId);
		await insertEvidence(supabase, {
			sessionId: id,
			userId,
			kind: "prompt",
			source: "learner",
			observationType: "trainer_prompt",
			payload: { content: parsed.data.message },
			idempotencyKey: `${idempotencyKey}:prompt`,
		});
		await supabase.from("messages").insert({
			session_id: id,
			user_id: userId,
			role: "user",
			content: parsed.data.message,
		});

		const { data: history } = await supabase
			.from("messages")
			.select("role, content")
			.eq("session_id", id)
			.eq("user_id", userId)
			.in("role", ["user", "assistant"])
			.order("created_at", { ascending: true })
			.limit(20);

		const result = await runTrainer({
			supabase,
			userId,
			sessionId: id,
			role: "trainer",
			config,
			apiKey,
			messages: (history ?? [])
				.map((row) => asChatTurn(row.role, row.content))
				.filter(
					(message): message is NonNullable<typeof message> => message !== null,
				),
		});

		await insertEvidence(supabase, {
			sessionId: id,
			userId,
			kind: "assistant",
			source: "provider",
			observationType: "trainer_reply",
			payload: { content: result.text, toolCount: result.toolCount },
			idempotencyKey: `${idempotencyKey}:assistant`,
		});
		await supabase.from("messages").insert({
			session_id: id,
			user_id: userId,
			role: "assistant",
			content: result.text,
		});
		await supabase.from("usage_records").upsert(
			{
				session_id: id,
				user_id: userId,
				operation_id: idempotencyKey,
				agent_role: "trainer",
				input_tokens: result.usage.inputTokens,
				output_tokens: result.usage.outputTokens,
				cached_tokens: result.usage.cachedTokens,
				cached_included_in_input: result.usage.cachedIncludedInInput,
				coverage: result.usage.coverage,
				native: result.usage.native,
			},
			{ onConflict: "session_id,operation_id" },
		);

		return NextResponse.json({
			reply: result.text,
			usage: result.usage,
			source: config.source,
			provider: config.provider,
			model: config.model,
		});
	} catch (error) {
		if (error instanceof LlmConfigError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}
		if (
			error instanceof MissingToolUseError ||
			error instanceof AgentBudgetError
		) {
			await insertEvidence(supabase, {
				sessionId: id,
				userId,
				kind: "system",
				source: "server",
				observationType: "trainer_incomplete",
				payload: { reason: error.message },
				idempotencyKey: newIdempotencyKey("trainer-incomplete"),
			});
			return NextResponse.json(
				{ error: error.message, incomplete: true },
				{ status: 409 },
			);
		}
		const message = error instanceof Error ? error.message : "Trainer failed.";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
