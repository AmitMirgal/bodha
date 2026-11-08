import { describe, expect, it } from "vitest";
import { aggregateUsage, normalizeUsage, usageFromAgentOutput } from "./usage";

describe("usage normalization", () => {
	it("marks missing usage as unknown, not zero", () => {
		expect(normalizeUsage(undefined)).toEqual({
			inputTokens: null,
			outputTokens: null,
			cachedTokens: null,
			cachedIncludedInInput: null,
			coverage: "unknown",
			native: null,
		});
	});

	it("keeps reported zero distinct from unknown", () => {
		const usage = normalizeUsage({ prompt_tokens: 0, completion_tokens: 10 });
		expect(usage.inputTokens).toBe(0);
		expect(usage.outputTokens).toBe(10);
		expect(usage.coverage).toBe("complete");
	});

	it("does not add cached tokens onto input", () => {
		const usage = normalizeUsage({
			prompt_tokens: 100,
			completion_tokens: 20,
			prompt_tokens_details: { cached_tokens: 40 },
		});
		expect(usage.inputTokens).toBe(100);
		expect(usage.cachedTokens).toBe(40);
		expect(usage.cachedIncludedInInput).toBe(true);
	});

	it("does not infer cache inclusion from cached <= input", () => {
		const usage = normalizeUsage({
			prompt_tokens: 100,
			completion_tokens: 1,
			cached_tokens: 40,
		});
		expect(usage.cachedTokens).toBe(40);
		expect(usage.cachedIncludedInInput).toBeNull();
	});

	it("records Anthropic-style cache reads as not included in input", () => {
		const usage = normalizeUsage({
			input_tokens: 10,
			output_tokens: 2,
			cache_read_input_tokens: 40,
		});
		expect(usage.cachedTokens).toBe(40);
		expect(usage.cachedIncludedInInput).toBe(false);
	});

	it("aggregates per-step usage instead of trusting a missing last-step field", () => {
		const usage = usageFromAgentOutput({
			steps: [
				{ usage: { prompt_tokens: 11, completion_tokens: 3 } },
				{ usage: { prompt_tokens: 4, completion_tokens: 8 } },
			],
		});
		expect(usage.inputTokens).toBe(15);
		expect(usage.outputTokens).toBe(11);
		expect(usage.coverage).toBe("complete");
	});

	it("aggregates with incomplete coverage disclosed", () => {
		const aggregate = aggregateUsage([
			normalizeUsage({ prompt_tokens: 10, completion_tokens: 2 }),
			normalizeUsage(undefined),
		]);
		expect(aggregate.incomplete).toBe(true);
		expect(aggregate.coverage).toBe("partial");
		expect(aggregate.inputTokens).toBeNull();
	});
});
