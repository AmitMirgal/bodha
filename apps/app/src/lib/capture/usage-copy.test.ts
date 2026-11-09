import { describe, expect, it } from "vitest";
import { preferredUsage, usageCopy } from "./usage-copy";

describe("usageCopy", () => {
	it("labels estimates and does not present missing as zero", () => {
		expect(usageCopy(null)).toContain("omitted, not guessed");
		expect(
			usageCopy(
				preferredUsage([
					{
						cachedTokens: null,
						inputTokens: 5,
						outputTokens: null,
						provenance: "estimated",
						source: "text_estimate",
					},
				])
			)
		).toContain("Estimated from text length");
		expect(
			usageCopy(
				preferredUsage([
					{
						cachedTokens: null,
						inputTokens: 5,
						outputTokens: null,
						provenance: "estimated",
						source: "text_estimate",
					},
				])
			)
		).not.toMatch(/output 0/);
		expect(
			usageCopy({
				cachedTokens: 3,
				inputTokens: 12,
				outputTokens: 4,
				provenance: "measured",
				reasoningTokens: 3,
				source: "copilot_otel_chat_span",
			})
		).toBe(
			"Reported by copilot_otel_chat_span: input 12, output 4, cached 3, reasoning 3."
		);
		expect(
			usageCopy({
				cachedTokens: null,
				inputTokens: 12,
				outputTokens: 4,
				provenance: "measured",
				reasoningTokens: null,
				source: "copilot_otel_chat_span",
			})
		).toContain("Partial vendor report");
		expect(
			usageCopy({
				cachedTokens: null,
				inputTokens: 12,
				outputTokens: 4,
				provenance: "measured",
				reasoningTokens: null,
				source: "copilot_otel_chat_span",
			})
		).not.toContain("null");
	});
});
