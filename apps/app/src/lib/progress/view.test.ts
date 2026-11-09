import { describe, expect, it } from "vitest";
import type { ProgressSessionInput } from "./types";
import { assembleProgressView, usageCopy } from "./view";

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
			cachedTokens: null,
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

function session(
	overrides: Partial<ProgressSessionInput>
): ProgressSessionInput {
	return {
		id: "sess-1",
		exerciseId: "shelf",
		status: "complete",
		createdAt: "2026-11-08T12:00:00.000Z",
		startedAt: "2026-11-08T12:01:00.000Z",
		finishedAt: "2026-11-08T12:10:00.000Z",
		prompts: ["Which test fails first?"],
		usageRows: [],
		report: null,
		...overrides,
	};
}

describe("assembleProgressView", () => {
	it("returns an empty day list when there are no sessions", () => {
		const view = assembleProgressView([], "UTC");
		expect(view.days).toEqual([]);
		expect(view.trend).toEqual([]);
		expect(view.timezone).toBe("UTC");
	});

	it("labels missing trainer tokens and omits them from the token trend", () => {
		const view = assembleProgressView(
			[
				session({
					usageRows: [
						{
							agent_role: "trainer",
							input_tokens: null,
							output_tokens: null,
							cached_tokens: null,
							cached_included_in_input: null,
							coverage: "unknown",
							native: null,
						},
					],
				}),
			],
			"UTC"
		);
		const task = view.days[0]?.tasks[0];
		expect(task?.usage.label).toBe("missing");
		expect(task?.usage.inputTokens).toBeNull();
		expect(view.trend[0]?.measuredInputTokens).toBeNull();
		expect(view.trend[0]?.taskCount).toBe(1);
		if (!task) {
			throw new Error("expected a task");
		}
		expect(usageCopy(task.usage)).toMatch(/omitted, not guessed/);
	});

	it("shows measured trainer tokens and grounded suggestions", () => {
		const view = assembleProgressView(
			[
				session({
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
				}),
			],
			"UTC"
		);
		const task = view.days[0]?.tasks[0];
		expect(task?.usage).toMatchObject({
			label: "measured",
			inputTokens: 12,
			outputTokens: 4,
			cachedTokens: 2,
			coverage: "complete",
		});
		expect(task?.outcome?.verificationProvenance).toBe("browser_harness");
		expect(task?.tests).toMatchObject({ found: true, passed: 1, failed: 2 });
		expect(task?.suggestions[0]?.improvedExample).toBe(
			"Which test fails first?"
		);
		expect(view.trend[0]?.measuredInputTokens).toBe(12);
		if (!task) {
			throw new Error("expected a measured task");
		}
		expect(usageCopy(task.usage)).toMatch(/Reported by the trainer provider/);
	});

	it("does not treat review-agent tokens as the task total", () => {
		const view = assembleProgressView(
			[
				session({
					usageRows: [
						{
							agent_role: "review",
							input_tokens: 999,
							output_tokens: 999,
							cached_tokens: 0,
							cached_included_in_input: false,
							coverage: "complete",
							native: null,
						},
					],
				}),
			],
			"UTC"
		);
		expect(view.days[0]?.tasks[0]?.usage.label).toBe("missing");
		expect(view.trend[0]?.measuredInputTokens).toBeNull();
	});

	it("does not invent zeros for unknown coverage", () => {
		const view = assembleProgressView([session({ usageRows: [] })], "UTC");
		expect(view.days[0]?.tasks[0]?.usage).toMatchObject({
			label: "missing",
			inputTokens: null,
			outputTokens: null,
			cachedTokens: null,
		});
	});
});
