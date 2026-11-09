import type { ProgressSessionInput, ProgressView } from "./types";
import { assembleProgressView } from "./view";

const promptId = "11111111-1111-4111-8111-111111111111";

const completeBody = {
	summary: "The learner ran tests.",
	observations: {
		tests: {
			found: true,
			passed: 1,
			failed: 2,
			total: 3,
			fatal: null,
			provenance: "browser_harness" as const,
		},
	},
	outcome: {
		observed:
			"Latest browser harness run observed 1 passing and 2 failing of 3 tests.",
		verification:
			"Results are browser-harness observations, not independent server execution.",
		verificationProvenance: "browser_harness" as const,
	},
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
	usage: {
		trainer: {
			inputTokens: 12,
			outputTokens: 4,
			cachedTokens: 2,
			coverage: "complete" as const,
		},
		review: {
			inputTokens: null,
			outputTokens: null,
			cachedTokens: null,
			coverage: "unknown" as const,
		},
		incomplete: true,
	},
	insufficientEvidence: [],
};

const measured: ProgressSessionInput = {
	id: "sess-measured",
	exerciseId: "shelf",
	status: "complete",
	createdAt: "2026-11-08T12:00:00.000Z",
	startedAt: "2026-11-08T12:01:00.000Z",
	finishedAt: "2026-11-08T12:10:00.000Z",
	prompts: ["Which test fails first?"],
	usageRows: [
		{
			agent_role: "trainer",
			input_tokens: 12,
			output_tokens: 4,
			cached_tokens: 2,
			cached_included_in_input: false,
			coverage: "complete",
			native: null,
		},
	],
	report: { status: "complete", body: completeBody },
};

const missing: ProgressSessionInput = {
	id: "sess-missing",
	exerciseId: "cache",
	status: "running",
	createdAt: "2026-11-09T10:00:00.000Z",
	startedAt: "2026-11-09T10:00:00.000Z",
	finishedAt: null,
	prompts: ["Help me finish the cache exercise."],
	usageRows: [],
	report: null,
};

export function emptyProgressView(): ProgressView {
	return assembleProgressView([], "UTC");
}

export function seededProgressView(): ProgressView {
	return assembleProgressView([measured, missing], "UTC");
}
