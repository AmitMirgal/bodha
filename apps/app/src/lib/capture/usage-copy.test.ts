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
	});
});
