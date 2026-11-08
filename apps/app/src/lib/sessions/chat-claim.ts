import { findEvidencePayload } from "../db/queries";
import type { BodhaDb } from "../db/rls";
import { insertEvidence } from "./service";

export type ChatClaim =
	| { kind: "fresh"; promptId: string }
	| { kind: "in_flight" }
	| {
			kind: "replay";
			reply: string;
	  };

export async function claimChatTurn(
	db: BodhaDb,
	input: {
		sessionId: string;
		userId: string;
		message: string;
		idempotencyKey: string;
	}
): Promise<ChatClaim> {
	const prompt = await insertEvidence(db, {
		sessionId: input.sessionId,
		userId: input.userId,
		kind: "prompt",
		source: "learner",
		observationType: "trainer_prompt",
		payload: { content: input.message },
		idempotencyKey: `${input.idempotencyKey}:prompt`,
	});
	if (!prompt.created) {
		const payload = await findEvidencePayload(
			db,
			input.sessionId,
			`${input.idempotencyKey}:assistant`
		);
		if (payload && typeof payload === "object") {
			const content = (payload as { content?: unknown }).content;
			if (typeof content === "string") {
				return { kind: "replay", reply: content };
			}
		}
		return { kind: "in_flight" };
	}
	return { kind: "fresh", promptId: prompt.id };
}
