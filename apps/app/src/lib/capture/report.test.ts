import { describe, expect, it } from "vitest";
import { assembleEditorLearningReport } from "./report";

const promptId = "11111111-1111-4111-8111-111111111111";
const taskId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("assembleEditorLearningReport", () => {
	it("cites prompt evidence and keeps estimated tokens off the trainer total", () => {
		const assembled = assembleEditorLearningReport({
			taskId,
			events: [
				{
					id: promptId,
					kind: "prompt",
					occurredAt: "2026-11-09T12:00:00.000Z",
					payload: { text: "Fix the flaky test" },
				},
				{
					id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
					kind: "session_end",
					occurredAt: "2026-11-09T12:05:00.000Z",
					payload: { reason: "stop" },
				},
			],
			usage: [
				{
					inputTokens: 20,
					outputTokens: 5,
					cachedTokens: null,
					reasoningTokens: null,
					provenance: "estimated",
					source: "text_estimate",
				},
			],
			model: {
				summary: "Name the failing test in the prompt.",
				suggestions: [
					{
						title: "Name the failing test",
						detail: "The stored prompt asked for a rewrite.",
						improvedExample: "Which test is flaky, and what assertion fails?",
						whyItHelps: "It uses the recorded prompt.",
						citations: [
							{ evidenceId: promptId, kind: "prompt", note: "prompt" },
						],
						illustrative: false,
					},
				],
				insufficientEvidence: [
					"Token counts are estimated from text length. They are not vendor-reported.",
				],
			},
		});
		expect(assembled.ok).toBe(true);
		if (!assembled.ok) {
			return;
		}
		expect(assembled.report.suggestions[0]?.citations[0]?.evidenceId).toBe(
			promptId
		);
		expect(assembled.report.usage.trainer.inputTokens).toBeNull();
		expect(assembled.report.usage.editor).toMatchObject({
			provenance: "estimated",
			coverage: "partial",
			inputTokens: 20,
			source: "text_estimate",
		});
		expect(assembled.report.outcome.verificationProvenance).toBe(
			"insufficient_evidence"
		);
		expect(assembled.report.outcome.observed).toContain("stop");
		expect(assembled.report.observations.tests.found).toBe(false);
	});

	it("rejects a citation that is not this task", () => {
		const assembled = assembleEditorLearningReport({
			taskId,
			events: [
				{
					id: promptId,
					kind: "prompt",
					occurredAt: "2026-11-09T12:00:00.000Z",
					payload: { text: "Fix the flaky test" },
				},
			],
			usage: [],
			model: {
				summary: "Invented citation.",
				suggestions: [
					{
						title: "Bad cite",
						detail: "detail",
						improvedExample: "example",
						whyItHelps: "why",
						citations: [
							{
								evidenceId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
								kind: "prompt",
								note: "other",
							},
						],
						illustrative: false,
					},
				],
				insufficientEvidence: [],
			},
		});
		expect(assembled.ok).toBe(false);
	});
});
