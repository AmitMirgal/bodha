import { describe, expect, it } from "vitest";
import { ToolsUnsupportedError } from "./errors";
import { toMastraModelConfig } from "./model-adapter";
import { DEFAULT_CAPABILITIES } from "./provider-types";

const supported = {
	tools: "supported" as const,
	structuredOutput: "supported" as const,
	streaming: "supported" as const,
	usageReporting: "supported" as const,
};

describe("toMastraModelConfig", () => {
	it("returns a Mastra router id and the caller-supplied key", () => {
		expect(
			toMastraModelConfig(
				{
					source: "user",
					provider: "openai",
					model: "gpt-4.1",
					capabilities: supported,
				},
				"sk-test-sentinel"
			)
		).toEqual({
			id: "openai/gpt-4.1",
			apiKey: "sk-test-sentinel",
		});
		expect(
			toMastraModelConfig(
				{
					source: "user",
					provider: "sarvam",
					model: "sarvam-105b",
					capabilities: supported,
				},
				"sk-test-sentinel"
			).id
		).toBe("sarvam/sarvam-105b");
	});

	it("refuses unknown providers and unproven tools", () => {
		expect(() =>
			toMastraModelConfig(
				{
					source: "user",
					provider: "openrouter",
					model: "gpt-4.1",
					capabilities: supported,
				},
				"sk-test-sentinel"
			)
		).toThrow(/Unknown provider/);
		expect(() =>
			toMastraModelConfig(
				{
					source: "user",
					provider: "openai",
					model: "gpt-4.1",
					capabilities: DEFAULT_CAPABILITIES,
				},
				"sk-test-sentinel"
			)
		).toThrow(ToolsUnsupportedError);
		expect(() =>
			toMastraModelConfig(
				{
					source: "user",
					provider: "openai",
					model: "gpt-4.1",
					capabilities: { ...DEFAULT_CAPABILITIES, tools: "unsupported" },
				},
				"sk-test-sentinel"
			)
		).toThrow(ToolsUnsupportedError);
	});
});
