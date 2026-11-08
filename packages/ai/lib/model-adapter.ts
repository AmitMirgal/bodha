import { ToolsUnsupportedError } from "./errors";
import type { ResolvedLlmConfig } from "./provider-types";

export interface OpenAiCompatibleModelRef {
	apiKey: string;
	id: `${string}/${string}`;
	url: string;
}

export function assertAgentToolsAllowed(config: ResolvedLlmConfig): void {
	if (config.capabilities.tools === "unsupported") {
		throw new ToolsUnsupportedError();
	}
}

export function toOpenAiCompatibleModel(
	config: ResolvedLlmConfig,
	apiKey: string,
): OpenAiCompatibleModelRef {
	assertAgentToolsAllowed(config);
	if (!apiKey) {
		throw new Error("LLM API key is missing.");
	}
	return {
		id: `${config.provider}/${config.model}` as `${string}/${string}`,
		url: config.baseUrl,
		apiKey,
	};
}
