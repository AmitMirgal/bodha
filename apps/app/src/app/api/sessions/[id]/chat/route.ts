import { NextResponse } from "next/server";
import { z } from "zod";
import { recentChronologicalTurns } from "../../../../../lib/chat/history";
import { runtimeRunWithDb, withUserDb } from "../../../../../lib/db/client";
import {
	insertMessage,
	listRecentChatTurns,
} from "../../../../../lib/db/queries";
import {
	PersistenceError,
	redactProviderError,
} from "../../../../../lib/errors";
import { newIdempotencyKey, operationId } from "../../../../../lib/idempotency";
import {
	LlmConfigError,
	resolveLlmForUser,
} from "../../../../../lib/llm/resolve-config";
import { claimChatTurn } from "../../../../../lib/sessions/chat-claim";
import {
	insertEvidence,
	insertUsageRecord,
} from "../../../../../lib/sessions/service";
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
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	const { userId } = await requireUser();
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

	const session = await withUserDb(userId, (db) =>
		db.session.findFirst({
			where: { id },
			select: { id: true, status: true },
		})
	);
	if (!session || session.status !== "running") {
		return NextResponse.json(
			{ error: "Session is not running." },
			{ status: 409 }
		);
	}

	const idempotencyKey = operationId(["chat", id, parsed.data.clientRequestId]);
	let claim: Awaited<ReturnType<typeof claimChatTurn>>;
	try {
		claim = await withUserDb(userId, (db) =>
			claimChatTurn(db, {
				sessionId: id,
				userId,
				message: parsed.data.message,
				idempotencyKey,
			})
		);
	} catch {
		return NextResponse.json(
			{ error: "Could not record the prompt." },
			{ status: 500 }
		);
	}
	if (claim.kind === "replay") {
		return NextResponse.json({
			replayed: true,
			reply: claim.reply,
		});
	}
	if (claim.kind === "in_flight") {
		return NextResponse.json(
			{
				error:
					"This chat turn is already in flight or failed after the prompt was recorded. Send a new request id to retry.",
				inFlight: true,
			},
			{ status: 409 }
		);
	}

	try {
		const { config, apiKey } = await withUserDb(userId, (db) =>
			resolveLlmForUser(db, userId)
		);
		await withUserDb(userId, (db) =>
			insertMessage(db, {
				sessionId: id,
				userId,
				evidenceId: claim.promptId,
				role: "user",
				content: parsed.data.message,
			})
		);

		const history = await withUserDb(userId, (db) =>
			listRecentChatTurns(db, id)
		);

		const result = await runTrainer({
			runWithDb: runtimeRunWithDb(),
			userId,
			sessionId: id,
			role: "trainer",
			config,
			apiKey,
			messages: recentChronologicalTurns(history)
				.map((row) => asChatTurn(row.role, row.content))
				.filter(
					(message): message is NonNullable<typeof message> => message !== null
				),
		});

		const assistant = await withUserDb(userId, (db) =>
			insertEvidence(db, {
				sessionId: id,
				userId,
				kind: "assistant",
				source: "provider",
				observationType: "trainer_reply",
				payload: { content: result.text, toolCount: result.toolCount },
				idempotencyKey: `${idempotencyKey}:assistant`,
			})
		);
		if (!assistant.created) {
			return NextResponse.json({
				replayed: true,
				reply: result.text,
			});
		}
		await withUserDb(userId, (db) =>
			insertMessage(db, {
				sessionId: id,
				userId,
				evidenceId: assistant.id,
				role: "assistant",
				content: result.text,
			})
		);
		await withUserDb(userId, (db) =>
			insertUsageRecord(db, {
				sessionId: id,
				userId,
				operationId: idempotencyKey,
				agentRole: "trainer",
				usage: result.usage,
			})
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
			await withUserDb(userId, (db) =>
				insertEvidence(db, {
					sessionId: id,
					userId,
					kind: "system",
					source: "server",
					observationType: "trainer_incomplete",
					payload: { reason: redactProviderError(error) },
					idempotencyKey: newIdempotencyKey("trainer-incomplete"),
				})
			);
			return NextResponse.json(
				{ error: redactProviderError(error), incomplete: true },
				{ status: 409 }
			);
		}
		if (error instanceof PersistenceError) {
			return NextResponse.json({ error: error.message }, { status: 500 });
		}
		return NextResponse.json(
			{ error: redactProviderError(error) },
			{ status: 500 }
		);
	}
}
