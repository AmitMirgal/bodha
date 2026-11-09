import { ToolsUnsupportedError } from "./errors";
import type { ResolvedLlmConfig } from "./provider-types";
import { mastraModelId, requireMatiProvider } from "./providers";

export interface MastraRouterConfig {
	apiKey: string;
	id: `${string}/${string}`;
}

export function assertAgentToolsAllowed(config: ResolvedLlmConfig): void {
	if (config.capabilities.tools !== "supported") {
		throw new ToolsUnsupportedError(
			config.capabilities.tools === "unsupported"
				? undefined
				: "This provider has not proven tool calling. Save settings after a successful connection check. Mati will not fall back to a one-shot completion."
		);
	}
}

export function toMastraModelConfig(
	config: ResolvedLlmConfig,
	apiKey: string
): MastraRouterConfig {
	assertAgentToolsAllowed(config);
	if (!apiKey) {
		throw new Error("LLM API key is missing.");
	}
	const provider = requireMatiProvider(config.provider);
	return {
		id: mastraModelId(provider.id, config.model),
		apiKey,
	};
}
