import { describe, expect, it, vi } from "vitest";
import { ToolsUnsupportedError } from "./errors";
import { toProtectedLanguageModel } from "./model-adapter";
import { DEFAULT_CAPABILITIES } from "./provider-types";

vi.mock("@ai-sdk/openai", () => ({
	createOpenAI: (options: { fetch?: unknown }) => {
		if (typeof options.fetch !== "function") {
			throw new Error("Protected fetch is required.");
		}
		return {
			chat: (model: string) => ({
				modelId: model,
				hasProtectedFetch: true,
			}),
		};
	},
}));

const endpoint = {
	href: "https://api.openai.com/v1",
	origin: "https://api.openai.com",
	host: "api.openai.com",
};

describe("toProtectedLanguageModel", () => {
	it("builds a chat model with injected protected fetch", () => {
		const model = toProtectedLanguageModel(
			{
				source: "user",
				protocol: "openai-compatible",
				provider: "openai",
				model: "gpt-4.1",
				baseUrl: "https://api.openai.com/v1",
				capabilities: { ...DEFAULT_CAPABILITIES, tools: "supported" },
			},
			"sk-test-sentinel",
			endpoint,
		);
		expect(model).toMatchObject({
			modelId: "gpt-4.1",
			hasProtectedFetch: true,
		});
	});

	it("refuses unknown and unsupported tool capabilities", () => {
		expect(() =>
			toProtectedLanguageModel(
				{
					source: "user",
					protocol: "openai-compatible",
					provider: "openai",
					model: "gpt-4.1",
					baseUrl: "https://api.openai.com/v1",
					capabilities: DEFAULT_CAPABILITIES,
				},
				"sk-test-sentinel",
				endpoint,
			),
		).toThrow(ToolsUnsupportedError);
		expect(() =>
			toProtectedLanguageModel(
				{
					source: "user",
					protocol: "openai-compatible",
					provider: "openai",
					model: "gpt-4.1",
					baseUrl: "https://api.openai.com/v1",
					capabilities: { ...DEFAULT_CAPABILITIES, tools: "unsupported" },
				},
				"sk-test-sentinel",
				endpoint,
			),
		).toThrow(ToolsUnsupportedError);
	});
});
