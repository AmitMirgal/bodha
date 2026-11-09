import { describe, expect, it } from "vitest";
import { ingestBodyFromCopilot, mapCopilotHook } from "./map-copilot";

describe("mapCopilotHook", () => {
	it("accepts Copilot Preview userPromptSubmitted + sessionId", () => {
		const mapped = mapCopilotHook({
			sessionId: "sess-1",
			hook_event_name: "userPromptSubmitted",
			prompt: "Fix the flaky test",
			timestamp: "2026-11-09T12:00:00.000Z",
		});
		expect(mapped?.editor).toBe("vscode");
		expect(mapped?.editorTaskId).toBe("sess-1");
		expect(mapped?.kind).toBe("prompt");
		expect(mapped?.text).toBe("Fix the flaky test");
	});

	it("accepts Local harness UserPromptSubmit + session_id", () => {
		const mapped = mapCopilotHook({
			session_id: "sess-1",
			hookEventName: "UserPromptSubmit",
			prompt: "Fix the flaky test",
		});
		expect(mapped?.kind).toBe("prompt");
		expect(mapped?.editorTaskId).toBe("sess-1");
	});

	it("maps Stop and sessionEnd to session_end", () => {
		expect(
			mapCopilotHook({
				sessionId: "sess-1",
				hook_event_name: "Stop",
				reason: "user",
			})?.kind
		).toBe("session_end");
		expect(
			mapCopilotHook({
				session_id: "sess-1",
				hook_event_name: "sessionEnd",
				reason: "idle",
			})?.kind
		).toBe("session_end");
	});

	it("maps edit tool paths and ignores read tools", () => {
		const edit = mapCopilotHook({
			sessionId: "sess-1",
			hook_event_name: "postToolUse",
			toolName: "strReplace",
			toolArgs: { path: "/Users/amit/mati/app.ts" },
		});
		expect(edit?.kind).toBe("file_edit");
		expect(edit?.path).toBe("app.ts");
		expect(
			mapCopilotHook({
				sessionId: "sess-1",
				hook_event_name: "postToolUse",
				toolName: "readFile",
				toolArgs: { path: "/Users/amit/mati/app.ts" },
			})
		).toBeNull();
	});

	it("adds a labelled text estimate for Copilot prompts", () => {
		const mapped = mapCopilotHook({
			sessionId: "sess-1",
			hook_event_name: "userPromptSubmitted",
			prompt: "abcd",
			timestamp: "2026-11-09T12:00:00.000Z",
		});
		if (!mapped) {
			throw new Error("expected mapped prompt");
		}
		const body = ingestBodyFromCopilot(mapped, "hash");
		expect(body.events[1]).toMatchObject({
			provenance: "estimated",
			source: "text_estimate",
			inputTokens: 1,
		});
	});
});
