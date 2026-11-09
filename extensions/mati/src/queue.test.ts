import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	drainOtelFile,
	drainQueueFile,
	workspaceHashFromFolders,
} from "./queue";

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

	it("posts Copilot Preview payloads and measured OTel spans", async () => {
		const dir = mkdtempSync(path.join(tmpdir(), "mati-q-copilot-"));
		const queuePath = path.join(dir, "device.jsonl");
		writeFileSync(
			queuePath,
			`${JSON.stringify({
				sessionId: "sess-1",
				hook_event_name: "userPromptSubmitted",
				prompt: "Fix the flaky test",
				timestamp: "2026-11-09T12:00:00.000Z",
			})}\n`
		);
		const bodies: string[] = [];
		await drainQueueFile({
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
		expect(bodies[0]).toContain('"editor":"vscode"');
		expect(bodies[0]).toContain("sess-1");
		const otelPath = path.join(dir, "copilot.jsonl");
		writeFileSync(
			otelPath,
			`${JSON.stringify({
				name: "chat",
				spanId: "span-1",
				timestamp: "2026-11-09T12:00:01.000Z",
				attributes: {
					"gen_ai.conversation.id": "sess-1",
					"gen_ai.usage.input_tokens": 12,
					"gen_ai.usage.output_tokens": 4,
					"gen_ai.usage.cache_read.input_tokens": 2,
					"gen_ai.usage.reasoning.output_tokens": 3,
					"gen_ai.request.model": "gpt-4.1",
				},
			})}\n`
		);
		const otelBodies: string[] = [];
		await drainOtelFile({
			otelPath,
			origin: "http://127.0.0.1:9",
			secret: "mati_dev_ab",
			workspaceHash: "abc",
			fetchImpl: (_url, init) => {
				otelBodies.push(String(init?.body ?? ""));
				return Promise.resolve(
					new Response(JSON.stringify({ accepted: 1 }), { status: 200 })
				);
			},
		});
		expect(otelBodies[0]).toContain("copilot_otel_chat_span");
		expect(otelBodies[0]).toContain('"provenance":"measured"');
		expect(otelBodies[0]).toContain('"reasoningTokens":3');
		expect(otelBodies[0]).not.toContain("captureContent");
	});
});
