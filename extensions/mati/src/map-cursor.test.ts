import { describe, expect, it } from "vitest";
import { ingestBodyFromCursor, mapCursorHook } from "./map-cursor";

describe("mapCursorHook", () => {
	it("maps the documented Cursor beforeSubmitPrompt shape", () => {
		const mapped = mapCursorHook({
			conversation_id: "conv-1",
			generation_id: "gen-1",
			hook_event_name: "beforeSubmitPrompt",
			prompt: "Fix the flaky test",
			attachments: [{ file_path: "/Users/amit/proj/src/app.ts" }],
			user_email: "secret@example.com",
			timestamp: "2026-11-09T12:00:00.000Z",
		});
		expect(mapped).toMatchObject({
			editorTaskId: "conv-1",
			kind: "prompt",
			text: "Fix the flaky test",
			attachmentNames: ["app.ts"],
		});
		if (!mapped) {
			throw new Error("expected mapped hook");
		}
		const body = ingestBodyFromCursor(mapped, "abc");
		expect(body.events[0]?.idempotencyKey).toBe("cursor:conv-1:prompt:gen-1");
		expect(body.events[1]?.kind).toBe("usage");
		expect(body.events[1]?.provenance).toBe("estimated");
	});

	it("maps afterFileEdit paths without snippets", () => {
		const mapped = mapCursorHook({
			conversation_id: "conv-1",
			hook_event_name: "afterFileEdit",
			file_path: "/Users/amit/proj/src/app.ts",
			edits: [{ old_string: "a", new_string: "b" }],
		});
		if (!mapped) {
			throw new Error("expected mapped hook");
		}
		expect(mapped.path).toBe("app.ts");
		const body = ingestBodyFromCursor(mapped, "abc");
		expect(body.events[0]?.path).toBe("app.ts");
		expect(JSON.stringify(body)).not.toContain("old_string");
	});
});
