import { assertNoRedirectToPrivate, type ValidatedEndpoint } from "./endpoint";
import type { CapabilityStatus, ProviderCapabilities } from "./provider-types";
import { DEFAULT_CAPABILITIES } from "./provider-types";

const TRAILING_SLASH = /\/$/;

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
		const modelsUrl = `${endpoint.href.replace(TRAILING_SLASH, "")}/models`;
		const response = await fetch(modelsUrl, {
			method: "GET",
			headers: {
				authorization: `Bearer ${apiKey}`,
			},
			redirect: "manual",
			signal: controller.signal,
		});

		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get("location");
			if (location) {
				assertNoRedirectToPrivate(
					new URL(location, endpoint.href).href,
					endpoint,
				);
			}
			return {
				capabilities,
				error:
					"The endpoint issued a redirect; refusing to follow it automatically.",
			};
		}

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
		capabilities.tools = "unknown";
		capabilities.structuredOutput = "unknown";
		capabilities.usageReporting = "unknown";
		return { capabilities };
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Connection check failed.";
		return { capabilities, error: message };
	} finally {
		clearTimeout(timer);
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
