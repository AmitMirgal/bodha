import type { ProviderCapabilities } from "./provider-types";

export const MATI_PROVIDERS = [
	"openai",
	"anthropic",
	"sarvam",
	"xai",
	"google",
] as const;

export type MatiProviderId = (typeof MATI_PROVIDERS)[number];

export interface MatiProvider {
	capabilities: ProviderCapabilities;
	id: MatiProviderId;
	label: string;
	mastraId: "openai" | "anthropic" | "sarvam" | "xai" | "google";
	notes: string[];
	officialUrl: string;
}

const ALL_SUPPORTED: ProviderCapabilities = {
	tools: "supported",
	structuredOutput: "supported",
	streaming: "supported",
	usageReporting: "supported",
};

export const PROVIDER_REGISTRY: Record<MatiProviderId, MatiProvider> = {
	openai: {
		id: "openai",
		label: "OpenAI",
		mastraId: "openai",
		officialUrl: "https://api.openai.com/v1",
		capabilities: ALL_SUPPORTED,
		notes: [
			"Mastra model router id openai/{model}. Official API is api.openai.com.",
		],
	},
	anthropic: {
		id: "anthropic",
		label: "Anthropic",
		mastraId: "anthropic",
		officialUrl: "https://api.anthropic.com",
		capabilities: ALL_SUPPORTED,
		notes: [
			"Mastra model router id anthropic/{model}. Official API is api.anthropic.com.",
		],
	},
	sarvam: {
		id: "sarvam",
		label: "Sarvam AI",
		mastraId: "sarvam",
		officialUrl: "https://api.sarvam.ai/v1",
		capabilities: {
			tools: "supported",
			structuredOutput: "unknown",
			streaming: "supported",
			usageReporting: "unknown",
		},
		notes: [
			"Mastra supports Sarvam natively (sarvam/{model}) via OpenAI-compatible chat completions at api.sarvam.ai.",
			"Official Chat Completions V2 documents tool calling. Native structured output and usage reporting are not treated as guaranteed.",
		],
	},
	xai: {
		id: "xai",
		label: "xAI Grok",
		mastraId: "xai",
		officialUrl: "https://api.x.ai/v1",
		capabilities: {
			tools: "supported",
			structuredOutput: "unknown",
			streaming: "supported",
			usageReporting: "supported",
		},
		notes: [
			"Mastra model router id xai/{model}. Official API is api.x.ai.",
			"Native structured output is not treated as guaranteed.",
		],
	},
	google: {
		id: "google",
		label: "Google Gemini",
		mastraId: "google",
		officialUrl: "https://generativelanguage.googleapis.com/v1beta",
		capabilities: ALL_SUPPORTED,
		notes: [
			"Mastra model router id google/{model}. Official Gemini API is generativelanguage.googleapis.com.",
		],
	},
};

export function isMatiProviderId(value: unknown): value is MatiProviderId {
	return (
		typeof value === "string" &&
		(MATI_PROVIDERS as readonly string[]).includes(value)
	);
}

export function parseMatiProvider(value: unknown): MatiProviderId | null {
	return isMatiProviderId(value) ? value : null;
}

export class UnknownProviderError extends Error {
	constructor(value: string) {
		super(
			`Unknown provider "${value}". Mati supports OpenAI, Anthropic, Sarvam AI, xAI Grok, and Google Gemini.`
		);
		this.name = "UnknownProviderError";
	}
}

export function requireMatiProvider(value: unknown): MatiProvider {
	if (!isMatiProviderId(value)) {
		throw new UnknownProviderError(String(value ?? ""));
	}
	return PROVIDER_REGISTRY[value];
}

export function listMatiProviders(): MatiProvider[] {
	return MATI_PROVIDERS.map((id) => PROVIDER_REGISTRY[id]);
}

export function publicProviderCatalog(): {
	capabilities: ProviderCapabilities;
	id: MatiProviderId;
	label: string;
	notes: string[];
}[] {
	return listMatiProviders().map((provider) => ({
		id: provider.id,
		label: provider.label,
		capabilities: provider.capabilities,
		notes: provider.notes,
	}));
}

export function mastraModelId(
	provider: MatiProviderId,
	model: string
): `${string}/${string}` {
	const trimmed = model.trim();
	if (!trimmed || trimmed.includes("/")) {
		throw new Error(
			"Model id must be the provider model name without a slash."
		);
	}
	return `${PROVIDER_REGISTRY[provider].mastraId}/${trimmed}` as `${string}/${string}`;
}

export function describeCapabilityGaps(
	capabilities: ProviderCapabilities
): string[] {
	const issues: string[] = [];
	switch (capabilities.tools) {
		case "unsupported":
			issues.push(
				"This provider does not support tool calling, which the trainer requires. Mati will not fall back to a one-shot completion."
			);
			break;
		case "unknown":
			issues.push(
				"Tool calling is not confirmed for this provider. Chat and reports will not run until it is proven. Mati will not fall back to a one-shot completion."
			);
			break;
		case "supported":
			break;
		default: {
			const exhaustive: never = capabilities.tools;
			throw new Error(`Unhandled tools capability: ${String(exhaustive)}`);
		}
	}
	switch (capabilities.structuredOutput) {
		case "unsupported":
			issues.push(
				"Native structured output is unsupported; Mati will validate JSON in the application instead."
			);
			break;
		case "unknown":
			issues.push(
				"Native structured output is not confirmed; Mati will validate JSON in the application instead of trusting a provider schema."
			);
			break;
		case "supported":
			break;
		default: {
			const exhaustive: never = capabilities.structuredOutput;
			throw new Error(
				`Unhandled structuredOutput capability: ${String(exhaustive)}`
			);
		}
	}
	switch (capabilities.streaming) {
		case "unsupported":
			issues.push(
				"Streaming is unsupported; replies will arrive in one piece."
			);
			break;
		case "unknown":
			issues.push("Streaming support is not confirmed for this provider.");
			break;
		case "supported":
			break;
		default: {
			const exhaustive: never = capabilities.streaming;
			throw new Error(`Unhandled streaming capability: ${String(exhaustive)}`);
		}
	}
	switch (capabilities.usageReporting) {
		case "unsupported":
			issues.push(
				"Token usage will be recorded as not reported by provider. Mati will not estimate it."
			);
			break;
		case "unknown":
			issues.push(
				"Token usage may be recorded as not reported by provider when the API omits it. Mati will not estimate it."
			);
			break;
		case "supported":
			break;
		default: {
			const exhaustive: never = capabilities.usageReporting;
			throw new Error(
				`Unhandled usageReporting capability: ${String(exhaustive)}`
			);
		}
	}
	return issues;
}
