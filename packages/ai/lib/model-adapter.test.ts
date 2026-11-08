import { describe, expect, it } from "vitest";
import { ToolsUnsupportedError } from "./errors";
import { toOpenAiCompatibleModel } from "./model-adapter";
import { DEFAULT_CAPABILITIES } from "./provider-types";

describe("toOpenAiCompatibleModel", () => {
	it("builds a shared OpenAI-compatible transport ref", () => {
		const model = toOpenAiCompatibleModel(
			{
				source: "user",
				protocol: "openai-compatible",
				provider: "openai",
				model: "gpt-4.1",
				baseUrl: "https://api.openai.com/v1",
				capabilities: DEFAULT_CAPABILITIES,
			},
			"sk-test-sentinel",
		);
		expect(model).toEqual({
			id: "openai/gpt-4.1",
			url: "https://api.openai.com/v1",
			apiKey: "sk-test-sentinel",
		});
	});

	it("refuses to construct a one-shot adapter when tools are unsupported", () => {
		expect(() =>
			toOpenAiCompatibleModel(
				{
					source: "user",
					protocol: "openai-compatible",
					provider: "openai",
					model: "gpt-4.1",
					baseUrl: "https://api.openai.com/v1",
					capabilities: { ...DEFAULT_CAPABILITIES, tools: "unsupported" },
				},
				"sk-test-sentinel",
			),
		).toThrow(ToolsUnsupportedError);
	});
});
