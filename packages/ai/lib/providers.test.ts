import { describe, expect, it } from "vitest";
import {
	describeCapabilityGaps,
	isMatiProviderId,
	listMatiProviders,
	MATI_PROVIDERS,
	mastraModelId,
	PROVIDER_REGISTRY,
	parseMatiProvider,
	publicProviderCatalog,
	requireMatiProvider,
	UnknownProviderError,
} from "./providers";

describe("fixed Mati provider registry", () => {
	it("accepts exactly the five shipping providers", () => {
		expect([...MATI_PROVIDERS]).toEqual([
			"openai",
			"anthropic",
			"sarvam",
			"xai",
			"google",
		]);
		expect(listMatiProviders()).toHaveLength(5);
		for (const id of MATI_PROVIDERS) {
			expect(isMatiProviderId(id)).toBe(true);
			expect(parseMatiProvider(id)).toBe(id);
			expect(requireMatiProvider(id).id).toBe(id);
		}
	});

	it("rejects any other provider id", () => {
		expect(parseMatiProvider("openai-compatible")).toBeNull();
		expect(parseMatiProvider("openrouter")).toBeNull();
		expect(parseMatiProvider("grok")).toBeNull();
		expect(() => requireMatiProvider("openrouter")).toThrow(
			UnknownProviderError
		);
		expect(() => requireMatiProvider("openrouter")).toThrow(/OpenAI/);
	});

	it("does not expose a user-supplied base URL field", () => {
		const catalog = publicProviderCatalog();
		expect(JSON.stringify(catalog)).not.toMatch(/baseUrl|base_url|ALLOWED_LLM/);
		for (const provider of listMatiProviders()) {
			expect(provider.officialUrl.startsWith("https://")).toBe(true);
			expect(mastraModelId(provider.id, "demo-model")).toBe(
				`${provider.mastraId}/demo-model`
			);
		}
	});

	it("surfaces capability gaps instead of inventing usage or tools", () => {
		const sarvam = PROVIDER_REGISTRY.sarvam.capabilities;
		const gaps = describeCapabilityGaps(sarvam);
		expect(sarvam.usageReporting).toBe("unknown");
		expect(gaps.some((line) => /not reported by provider/i.test(line))).toBe(
			true
		);
		expect(
			describeCapabilityGaps({
				tools: "unsupported",
				structuredOutput: "unsupported",
				streaming: "unsupported",
				usageReporting: "unsupported",
			}).length
		).toBeGreaterThan(0);
	});

	it("builds Mastra router ids without a custom host", () => {
		expect(mastraModelId("openai", "gpt-4.1")).toBe("openai/gpt-4.1");
		expect(mastraModelId("sarvam", "sarvam-105b")).toBe("sarvam/sarvam-105b");
		expect(() => mastraModelId("openai", "openai/gpt-4.1")).toThrow(/slash/);
	});
});
