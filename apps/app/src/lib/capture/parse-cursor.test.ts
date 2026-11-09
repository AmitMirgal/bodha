import { describe, expect, it } from "vitest";
import { cursorKind, parseCursorHook } from "./parse-cursor";

describe("parseCursorHook", () => {
	it("maps documented beforeSubmitPrompt fields", () => {
		const parsed = parseCursorHook({
			conversation_id: "conv-1",
			generation_id: "gen-1",
			hook_event_name: "beforeSubmitPrompt",
			prompt: "Fix the flaky test",
			user_email: "secret@example.com",
		});
		expect(parsed).toMatchObject({
			conversationId: "conv-1",
			generationId: "gen-1",
			prompt: "Fix the flaky test",
		});
		expect(cursorKind(parsed?.hookEventName ?? "")).toBe("prompt");
	});

	it("uses session_id when conversation_id is absent", () => {
		const parsed = parseCursorHook({
			session_id: "conv-2",
			hook_event_name: "sessionEnd",
			reason: "completed",
		});
		expect(parsed?.conversationId).toBe("conv-2");
		expect(cursorKind("sessionEnd")).toBe("session_end");
	});

	it("maps afterAgentResponse text", () => {
		const parsed = parseCursorHook({
			conversation_id: "conv-3",
			hook_event_name: "afterAgentResponse",
			text: "I updated the test.",
		});
		expect(parsed?.responseText).toBe("I updated the test.");
		expect(cursorKind(parsed?.hookEventName ?? "")).toBe("response");
		expect(cursorKind("afterAgentThought")).toBeNull();
	});
});
