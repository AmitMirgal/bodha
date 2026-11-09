import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { endpointFromHref, type ValidatedEndpoint } from "./endpoint";
import { ToolsUnsupportedError } from "./errors";
import type { ResolvedLlmConfig } from "./provider-types";
import { createProtectedFetch } from "./transport";

export function assertAgentToolsAllowed(config: ResolvedLlmConfig): void {
	if (config.capabilities.tools !== "supported") {
		throw new ToolsUnsupportedError(
			config.capabilities.tools === "unsupported"
				? undefined
				: "This provider has not proven tool calling. Save settings after a successful connection check. Mati will not fall back to a one-shot completion."
		);
	}
}

export function toProtectedLanguageModel(
	config: ResolvedLlmConfig,
	apiKey: string,
	endpoint: ValidatedEndpoint
): LanguageModelV3 {
	assertAgentToolsAllowed(config);
	if (!apiKey) {
		throw new Error("LLM API key is missing.");
	}
	const expected = endpointFromHref(config.baseUrl);
	if (
		expected.href !== endpoint.href ||
		expected.origin !== endpoint.origin ||
		expected.host !== endpoint.host
	) {
		throw new Error("Resolved base URL does not match the validated endpoint.");
	}
	const openai = createOpenAI({
		baseURL: endpoint.href,
		apiKey,
		name: config.provider,
		fetch: createProtectedFetch(endpoint),
	});
	return openai.chat(config.model);
}
