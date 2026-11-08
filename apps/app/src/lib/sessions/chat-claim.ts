import type { SupabaseClient } from "@supabase/supabase-js";
import { insertEvidence } from "./service";

export type ChatClaim =
	| { kind: "fresh"; promptId: string }
	| { kind: "in_flight" }
	| {
			kind: "replay";
			reply: string;
	  };

export async function claimChatTurn(
	supabase: SupabaseClient,
	input: {
		sessionId: string;
		userId: string;
		message: string;
		idempotencyKey: string;
	},
): Promise<ChatClaim> {
	const prompt = await insertEvidence(supabase, {
		sessionId: input.sessionId,
		userId: input.userId,
		kind: "prompt",
		source: "learner",
		observationType: "trainer_prompt",
		payload: { content: input.message },
		idempotencyKey: `${input.idempotencyKey}:prompt`,
	});
	if (!prompt.created) {
		const { data: assistant } = await supabase
			.from("evidence_events")
			.select("payload")
			.eq("session_id", input.sessionId)
			.eq("user_id", input.userId)
			.eq("idempotency_key", `${input.idempotencyKey}:assistant`)
			.maybeSingle();
		if (assistant?.payload && typeof assistant.payload === "object") {
			const content = (assistant.payload as { content?: unknown }).content;
			if (typeof content === "string") {
				return { kind: "replay", reply: content };
			}
		}
		return { kind: "in_flight" };
	}
	return { kind: "fresh", promptId: prompt.id };
}
