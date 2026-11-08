import { describe, expect, it } from "vitest";
import { aggregateUsage, normalizeUsage } from "./usage";

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
