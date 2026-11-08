export const LLM_PROTOCOL = "openai-compatible" as const;

export type LlmProtocol = typeof LLM_PROTOCOL;

export type CapabilityStatus = "supported" | "unsupported" | "unknown";

export interface ProviderCapabilities {
	streaming: CapabilityStatus;
	structuredOutput: CapabilityStatus;
	tools: CapabilityStatus;
	usageReporting: CapabilityStatus;
}

export interface ResolvedLlmConfig {
	baseUrl: string;
	capabilities: ProviderCapabilities;
	model: string;
	protocol: LlmProtocol;
	provider: string;
	source: "user" | "operator_default";
}

export interface MaskedLlmSettings {
	baseUrl: string | null;
	capabilities: ProviderCapabilities | null;
	configured: boolean;
	keyFingerprint: string | null;
	model: string | null;
	provider: string | null;
	source: "user" | "operator_default" | "none";
}

export const DEFAULT_CAPABILITIES: ProviderCapabilities = {
	tools: "unknown",
	structuredOutput: "unknown",
	streaming: "unknown",
	usageReporting: "unknown",
};
