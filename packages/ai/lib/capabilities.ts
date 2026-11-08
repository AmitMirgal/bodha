import type { ValidatedEndpoint } from "./endpoint";
import type { CapabilityStatus, ProviderCapabilities } from "./provider-types";
import { DEFAULT_CAPABILITIES } from "./provider-types";
import { fetchApprovedEndpoint } from "./transport";

export interface ProbeResult {
	capabilities: ProviderCapabilities;
	error?: string;
}

const timeoutSignal = (ms: number) => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ms);
	return { controller, timer };
};

export async function probeOpenAiCompatible(
	endpoint: ValidatedEndpoint,
	apiKey: string,
	model: string,
): Promise<ProbeResult> {
	const capabilities: ProviderCapabilities = { ...DEFAULT_CAPABILITIES };
	const { controller, timer } = timeoutSignal(12_000);

	try {
		const response = await fetchApprovedEndpoint(endpoint, "/models", {
			method: "GET",
			headers: {
				authorization: `Bearer ${apiKey}`,
			},
			signal: controller.signal,
		});

		if (!response.ok) {
			capabilities.tools = "unknown";
			return {
				capabilities,
				error: `Connection check failed (${response.status}). The key or endpoint was rejected.`,
			};
		}

		const body = (await response.json()) as {
			data?: { id?: string }[];
		};
		const ids = new Set(
			(body.data ?? []).map((item) => item.id).filter(Boolean),
		);
		if (ids.size > 0 && !ids.has(model)) {
			return {
				capabilities,
				error: `The endpoint did not list model "${model}". It may still work, but the id is unconfirmed.`,
			};
		}

		capabilities.streaming = "unknown";
		capabilities.structuredOutput = "unknown";
		capabilities.usageReporting = "unknown";
		capabilities.tools = await probeToolSupport(
			endpoint,
			apiKey,
			model,
			controller.signal,
		);
		if (capabilities.tools === "unsupported") {
			return {
				capabilities,
				error:
					"This endpoint rejected tool calling. BODHA will not fall back to a one-shot completion.",
			};
		}
		return { capabilities };
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Connection check failed.";
		if (/redirect/i.test(message) || /private/i.test(message)) {
			return { capabilities, error: message };
		}
		return {
			capabilities,
			error: "Connection check failed.",
		};
	} finally {
		clearTimeout(timer);
	}
}

async function probeToolSupport(
	endpoint: ValidatedEndpoint,
	apiKey: string,
	model: string,
	signal: AbortSignal,
): Promise<CapabilityStatus> {
	try {
		const response = await fetchApprovedEndpoint(
			endpoint,
			"/chat/completions",
			{
				method: "POST",
				headers: {
					authorization: `Bearer ${apiKey}`,
					"content-type": "application/json",
				},
				signal,
				body: JSON.stringify({
					model,
					messages: [{ role: "user", content: "." }],
					max_tokens: 1,
					tool_choice: "none",
					tools: [
						{
							type: "function",
							function: {
								name: "bodha_capability_ping",
								description: "Capability probe only. Do not call.",
								parameters: { type: "object", properties: {} },
							},
						},
					],
				}),
			},
		);
		if (response.status === 404) {
			return "unsupported";
		}
		if (response.ok) {
			return "supported";
		}
		const text = (await response.text()).toLowerCase();
		if (
			text.includes("tool") ||
			text.includes("function calling") ||
			text.includes("tools is not supported")
		) {
			return "unsupported";
		}
		return "unknown";
	} catch {
		return "unknown";
	}
}

export function requireTools(
	capabilities: ProviderCapabilities,
): CapabilityStatus {
	return capabilities.tools;
}

export function describeUnsupported(
	capabilities: ProviderCapabilities,
): string[] {
	const issues: string[] = [];
	if (capabilities.tools === "unsupported") {
		issues.push(
			"This endpoint does not support tool calling, which the trainer requires.",
		);
	}
	if (capabilities.structuredOutput === "unsupported") {
		issues.push(
			"Native structured output is unsupported; BODHA will validate JSON in the application instead.",
		);
	}
	if (capabilities.streaming === "unsupported") {
		issues.push("Streaming is unsupported; replies will arrive in one piece.");
	}
	if (capabilities.usageReporting === "unsupported") {
		issues.push("Token usage will be recorded as unknown.");
	}
	return issues;
}
