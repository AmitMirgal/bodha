import { describe, expect, it } from "vitest";
import { parseProviderCapabilities } from "./provider-types";

describe("parseProviderCapabilities", () => {
	it("accepts a complete capability object and rejects partial ones", () => {
		expect(
			parseProviderCapabilities({
				tools: "supported",
				structuredOutput: "unknown",
				streaming: "unknown",
				usageReporting: "unknown",
			})?.tools,
		).toBe("supported");
		expect(parseProviderCapabilities({ tools: "supported" })).toBeNull();
		expect(parseProviderCapabilities(null)).toBeNull();
	});
});
