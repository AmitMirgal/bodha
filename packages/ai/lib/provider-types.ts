export type CapabilityStatus = "supported" | "unsupported" | "unknown";

export interface ProviderCapabilities {
	streaming: CapabilityStatus;
	structuredOutput: CapabilityStatus;
	tools: CapabilityStatus;
	usageReporting: CapabilityStatus;
}

export interface ResolvedLlmConfig {
	capabilities: ProviderCapabilities;
	model: string;
	provider: string;
	source: "user" | "operator_default";
}

export interface MaskedLlmSettings {
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

const STATUSES: readonly CapabilityStatus[] = [
	"supported",
	"unsupported",
	"unknown",
];

function isCapabilityStatus(value: unknown): value is CapabilityStatus {
	return (
		typeof value === "string" && STATUSES.includes(value as CapabilityStatus)
	);
}

export function parseProviderCapabilities(
	value: unknown
): ProviderCapabilities | null {
	if (!value || typeof value !== "object") {
		return null;
	}
	const record = value as Record<string, unknown>;
	if (
		!(
			isCapabilityStatus(record.tools) &&
			isCapabilityStatus(record.structuredOutput) &&
			isCapabilityStatus(record.streaming) &&
			isCapabilityStatus(record.usageReporting)
		)
	) {
		return null;
	}
	return {
		tools: record.tools,
		structuredOutput: record.structuredOutput,
		streaming: record.streaming,
		usageReporting: record.usageReporting,
	};
}
