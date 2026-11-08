import { describe, expect, it } from "vitest";
import {
	type LearningReport,
	reportSchema,
	validateReportAgainstEvidence,
} from "./schema";

const evidence = [
	{
		id: "11111111-1111-4111-8111-111111111111",
		kind: "prompt",
		sessionId: "sess",
	},
	{
		id: "22222222-2222-4222-8222-222222222222",
		kind: "test_run",
		sessionId: "sess",
	},
];

const valid = (): LearningReport => ({
	summary: "The learner ran tests and asked one question.",
	observations: {
		tests: {
			found: true,
			passed: 0,
			failed: 1,
			total: 1,
			fatal: null,
			provenance: "browser_harness",
		},
	},
	outcome: {
		observed: "One test run recorded by the browser harness.",
		verification: "Harness reported failing tests.",
		verificationProvenance: "browser_harness",
	},
	suggestions: [
		{
			title: "Ask about one failing test",
			detail: "The prompt asked for a full rewrite.",
			improvedExample:
				"Which test fails first, and what does the README say it should return?",
			whyItHelps:
				"It points at observed evidence instead of a generic rewrite.",
			citations: [
				{
					evidenceId: "11111111-1111-4111-8111-111111111111",
					kind: "prompt",
					note: "Original prompt",
				},
			],
			illustrative: false,
		},
	],
	usage: {
		trainer: {
			inputTokens: null,
			outputTokens: null,
			cachedTokens: null,
			coverage: "unknown",
		},
		review: {
			inputTokens: null,
			outputTokens: null,
			cachedTokens: null,
			coverage: "unknown",
		},
		incomplete: true,
	},
	insufficientEvidence: [],
});

describe("report validation", () => {
	it("accepts a schema-valid evidence-linked report", () => {
		const parsed = reportSchema.parse(valid());
		expect(validateReportAgainstEvidence(parsed, evidence, "sess").ok).toBe(
			true
		);
	});

	it("rejects cross-session citations", () => {
		const report = valid();
		const result = validateReportAgainstEvidence(
			report,
			evidence,
			"other-session"
		);
		expect(result.ok).toBe(false);
	});

	it("rejects harness verification without test evidence", () => {
		const report = valid();
		const result = validateReportAgainstEvidence(report, [evidence[0]], "sess");
		expect(result.ok).toBe(false);
	});
});
