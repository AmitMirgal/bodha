import { describe, expect, it } from "vitest";
import { assembleLearningReport, outcomeFromEvidence } from "./assemble";

const promptId = "11111111-1111-4111-8111-111111111111";
const testId = "22222222-2222-4222-8222-222222222222";

const model = {
	summary: "The learner ran tests.",
	suggestions: [
		{
			title: "Ask about the failing test",
			detail: "The prompt asked for a rewrite.",
			improvedExample: "Which test fails first?",
			whyItHelps: "It uses the recorded prompt.",
			citations: [
				{ evidenceId: promptId, kind: "prompt" as const, note: "prompt" },
			],
			illustrative: false,
		},
	],
	insufficientEvidence: [],
	outcome: {
		observed: "MODEL CLAIM: all tests passed.",
		verification: "MODEL CLAIM",
		verificationProvenance: "browser_harness" as const,
	},
	usage: {
		trainer: {
			inputTokens: 9999,
			outputTokens: 9999,
			cachedTokens: 0,
			coverage: "complete" as const,
		},
		review: {
			inputTokens: 1,
			outputTokens: 1,
			cachedTokens: 0,
			coverage: "complete" as const,
		},
		incomplete: false,
	},
};

describe("assembleLearningReport", () => {
	it("computes outcome from harness payloads and usage from stored rows, ignoring model numbers", () => {
		const assembled = assembleLearningReport({
			sessionId: "sess",
			model,
			evidence: [
				{
					id: promptId,
					kind: "prompt",
					sessionId: "sess",
					payload: { content: "help" },
				},
				{
					id: testId,
					kind: "test_run",
					sessionId: "sess",
					payload: {
						results: [{ pass: true }, { pass: false }, { pass: false }],
						fatal: null,
					},
				},
			],
			usageRows: [
				{
					agent_role: "trainer",
					input_tokens: 12,
					output_tokens: 4,
					cached_tokens: null,
					cached_included_in_input: null,
					coverage: "complete",
					native: null,
				},
			],
		});
		expect(assembled.ok).toBe(true);
		if (!assembled.ok) {
			return;
		}
		expect(assembled.report.outcome.observed).toMatch(
			/1 passing and 2 failing/,
		);
		expect(assembled.report.outcome.observed).not.toMatch(/all tests passed/);
		expect(assembled.report.usage.trainer.inputTokens).toBe(12);
		expect(assembled.report.usage.review.inputTokens).toBeNull();
		expect(assembled.report.usage.incomplete).toBe(true);
	});

	it("does not treat missing tests as a passing harness result", () => {
		const outcome = outcomeFromEvidence([
			{ id: promptId, kind: "prompt", sessionId: "sess", payload: {} },
		]);
		expect(outcome.verificationProvenance).toBe("insufficient_evidence");
	});
});
