import { describe, expect, it } from "vitest";
import { claimChatTurn } from "./chat-claim";

function db(script: {
	promptCreated: boolean;
	assistant?: { content: string } | null;
}) {
	return {
		$executeRawUnsafe: async () => await Promise.resolve(undefined),
		evidenceEvent: {
			create: async () => {
				if (script.promptCreated) {
					return await Promise.resolve({ id: "p1", seq: 1n });
				}
				await Promise.resolve();
				throw Object.assign(new Error("unique"), { code: "P2002" });
			},
			findFirst: async ({ where }: { where: { idempotencyKey?: string } }) => {
				if (String(where.idempotencyKey ?? "").endsWith(":assistant")) {
					return await Promise.resolve(
						script.assistant
							? { payload: { content: script.assistant.content } }
							: null
					);
				}
				return await Promise.resolve({ id: "p1", seq: 1n });
			},
		},
	};
}

describe("claimChatTurn", () => {
	it("claims a fresh prompt insert", async () => {
		const claim = await claimChatTurn(db({ promptCreated: true }) as never, {
			sessionId: "s",
			userId: "u",
			message: "hello",
			idempotencyKey: "k",
		});
		expect(claim).toEqual({ kind: "fresh", promptId: "p1" });
	});

	it("replays a completed assistant turn", async () => {
		const claim = await claimChatTurn(
			db({
				promptCreated: false,
				assistant: { content: "already" },
			}) as never,
			{
				sessionId: "s",
				userId: "u",
				message: "hello",
				idempotencyKey: "k",
			}
		);
		expect(claim).toEqual({ kind: "replay", reply: "already" });
	});

	it("returns in-flight when the prompt exists without an assistant", async () => {
		const claim = await claimChatTurn(
			db({ promptCreated: false, assistant: null }) as never,
			{
				sessionId: "s",
				userId: "u",
				message: "hello",
				idempotencyKey: "k",
			}
		);
		expect(claim.kind).toBe("in_flight");
	});
});
