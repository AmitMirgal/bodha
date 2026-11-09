import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CURSOR_HOOK = path.resolve(import.meta.dirname, "../hooks/cursor.mjs");
const COPILOT_HOOK = path.resolve(import.meta.dirname, "../hooks/copilot.mjs");

describe("hook commands", () => {
	it("exits 0, continues, and drops user_email for Cursor", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "mati-hook-"));
		const stdout = execFileSync("node", [CURSOR_HOOK], {
			input: JSON.stringify({
				conversation_id: "conv-1",
				hook_event_name: "beforeSubmitPrompt",
				prompt: "Fix the flaky test",
				user_email: "secret@example.com",
			}),
			env: {
				...process.env,
				MATI_QUEUE_DIR: dir,
				MATI_DEVICE_ID: "dev1",
			},
			encoding: "utf8",
		});
		expect(JSON.parse(stdout)).toEqual({ continue: true });
		const stored = JSON.parse(
			readFileSync(path.join(dir, "dev1.jsonl"), "utf8").trim()
		) as { prompt?: string; user_email?: string };
		expect(stored.prompt).toBe("Fix the flaky test");
		expect(stored.user_email).toBeUndefined();
	});

	it("exits 0, writes {} for Copilot, and drops userEmail", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "mati-copilot-hook-"));
		const stdout = execFileSync("node", [COPILOT_HOOK], {
			input: JSON.stringify({
				sessionId: "sess-1",
				hook_event_name: "userPromptSubmitted",
				prompt: "Fix the flaky test",
				userEmail: "secret@example.com",
			}),
			env: {
				...process.env,
				MATI_QUEUE_DIR: dir,
				MATI_DEVICE_ID: "dev1",
			},
			encoding: "utf8",
		});
		expect(JSON.parse(stdout)).toEqual({});
		const stored = JSON.parse(
			readFileSync(path.join(dir, "dev1.jsonl"), "utf8").trim()
		) as { prompt?: string; userEmail?: string };
		expect(stored.prompt).toBe("Fix the flaky test");
		expect(stored.userEmail).toBeUndefined();
	});
});
