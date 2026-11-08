import { describe, expect, it } from "vitest";
import { claimChatTurn } from "./chat-claim";

function client(script: {
	promptCreated: boolean;
	assistant?: { content: string } | null;
}) {
	return {
		from(table: string) {
			if (table !== "evidence_events") {
				throw new Error(table);
			}
			return {
				insert() {
					return {
						select() {
							return {
								single: async () =>
									script.promptCreated
										? { data: { id: "p1", seq: 1 }, error: null }
										: { data: null, error: { code: "23505" } },
							};
						},
					};
				},
				select() {
					const filters: Record<string, string> = {};
					const query = {
						eq(column: string, value: string) {
							filters[column] = value;
							return query;
						},
						maybeSingle: async () => {
							if (
								String(filters.idempotency_key ?? "").endsWith(":assistant")
							) {
								return {
									data: script.assistant
										? { payload: { content: script.assistant.content } }
										: null,
									error: null,
								};
							}
							return { data: { id: "p1", seq: 1 }, error: null };
						},
					};
					return query;
				},
			};
		},
	};
}

describe("claimChatTurn", () => {
	it("claims a fresh prompt insert", async () => {
		const claim = await claimChatTurn(
			client({ promptCreated: true }) as never,
			{
				sessionId: "s",
				userId: "u",
				message: "hello",
				idempotencyKey: "k",
			},
		);
		expect(claim).toEqual({ kind: "fresh", promptId: "p1" });
	});

	it("replays a completed assistant turn", async () => {
		const claim = await claimChatTurn(
			client({
				promptCreated: false,
				assistant: { content: "already" },
			}) as never,
			{
				sessionId: "s",
				userId: "u",
				message: "hello",
				idempotencyKey: "k",
			},
		);
		expect(claim).toEqual({ kind: "replay", reply: "already" });
	});

	it("returns in-flight when the prompt exists without an assistant", async () => {
		const claim = await claimChatTurn(
			client({ promptCreated: false, assistant: null }) as never,
			{
				sessionId: "s",
				userId: "u",
				message: "hello",
				idempotencyKey: "k",
			},
		);
		expect(claim.kind).toBe("in_flight");
	});
});
