import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { drainQueueFile, workspaceHashFromFolders } from "./queue";

describe("queue drain", () => {
	it("posts mapped Cursor hook lines and drops user_email from the body", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "mati-q-"));
		const queuePath = path.join(dir, "device.jsonl");
		writeFileSync(
			queuePath,
			`${JSON.stringify({
				conversation_id: "conv-1",
				generation_id: "g1",
				hook_event_name: "beforeSubmitPrompt",
				prompt: "Fix the flaky test AKIAIOSFODNN7EXAMPLE",
				user_email: "secret@example.com",
				timestamp: "2026-11-09T12:00:00.000Z",
			})}\n`
		);
		const bodies: string[] = [];
		const result = await drainQueueFile({
			queuePath,
			origin: "http://127.0.0.1:9",
			secret: "mati_dev_ab",
			workspaceHash: "abc",
			fetchImpl: (_url, init) => {
				bodies.push(String(init?.body ?? ""));
				return Promise.resolve(
					new Response(JSON.stringify({ accepted: 1 }), { status: 200 })
				);
			},
		});
		expect(result.posted).toBe(1);
		expect(bodies[0]).toContain("Fix the flaky test [redacted:aws_access_key]");
		expect(bodies[0]).toContain("text_estimate");
		expect(bodies[0]).not.toContain("AKIAIOSFODNN7EXAMPLE");
		expect(bodies[0]).not.toContain("secret@example.com");
		expect(workspaceHashFromFolders(["/Users/amit/mati"])).toMatch(
			/^[0-9a-f]{64}$/
		);
		expect(workspaceHashFromFolders(["/Users/amit/mati"])).not.toContain(
			"Users"
		);
	});
});
