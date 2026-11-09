import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const HOOK = path.resolve(import.meta.dirname, "../hooks/cursor.mjs");

describe("cursor hook command", () => {
	it("exits 0, continues, and drops user_email", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "mati-hook-"));
		const stdout = execFileSync("node", [HOOK], {
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
});
