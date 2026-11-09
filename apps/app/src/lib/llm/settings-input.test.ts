import { describe, expect, it } from "vitest";
import { LlmSettingsInputError, parseLlmSettingsInput } from "./settings-input";

const KEY = "sk-test-sentinel";

describe("parseLlmSettingsInput", () => {
	it("accepts only the five providers", () => {
		for (const provider of [
			"openai",
			"anthropic",
			"sarvam",
			"xai",
			"google",
		] as const) {
			expect(
				parseLlmSettingsInput({
					provider,
					model: "demo-model",
					apiKey: KEY,
				}).provider
			).toBe(provider);
		}
		expect(() =>
			parseLlmSettingsInput({
				provider: "openrouter",
				model: "demo-model",
				apiKey: KEY,
			})
		).toThrow(/Unknown provider/);
		expect(() =>
			parseLlmSettingsInput({
				provider: "openai-compatible",
				model: "demo-model",
				apiKey: KEY,
			})
		).toThrow(LlmSettingsInputError);
	});

	it("rejects a supplied base URL", () => {
		expect(() =>
			parseLlmSettingsInput({
				provider: "openai",
				model: "gpt-4.1",
				apiKey: KEY,
				baseUrl: "https://api.openai.com/v1",
			})
		).toThrow(/does not accept a base URL/);
		expect(() =>
			parseLlmSettingsInput({
				provider: "openai",
				model: "gpt-4.1",
				apiKey: KEY,
				base_url: "https://evil.example/v1",
			})
		).toThrow(/does not accept a base URL/);
	});
});
