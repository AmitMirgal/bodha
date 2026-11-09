import { z } from "zod";
import { matiEnv } from "./mati-env";

const publicSchema = z.object({
	NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
	NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

export function getPublicSupabaseConfig() {
	const parsed = publicSchema.safeParse({
		NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
		NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
			process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
	});
	if (!parsed.success) {
		throw new Error(
			"Supabase public config is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
		);
	}
	return {
		url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
		publishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
	};
}

export function getAllowedLlmHosts(): string[] {
	return (matiEnv("ALLOWED_LLM_HOSTS") ?? "")
		.split(",")
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean);
}

export function allowHttpLlm(): boolean {
	return matiEnv("ALLOW_HTTP_LLM") === "true";
}

function parseCapabilityStatus(
	raw: string | undefined
): "supported" | "unsupported" | "unknown" {
	const tools = raw?.trim() ?? "unknown";
	switch (tools) {
		case "supported":
		case "unsupported":
		case "unknown":
			return tools;
		default:
			return "unknown";
	}
}

export function getOperatorDefault() {
	const provider = matiEnv("OPERATOR_LLM_PROVIDER")?.trim();
	const model = matiEnv("OPERATOR_LLM_MODEL")?.trim();
	const baseUrl = matiEnv("OPERATOR_LLM_BASE_URL")?.trim();
	const apiKey = matiEnv("OPERATOR_LLM_API_KEY")?.trim();
	if (!(provider && model && baseUrl && apiKey)) {
		return null;
	}
	return {
		provider,
		model,
		baseUrl,
		apiKey,
		source: "operator_default" as const,
		capabilities: {
			tools: parseCapabilityStatus(matiEnv("OPERATOR_LLM_TOOLS")),
			structuredOutput: "unknown" as const,
			streaming: "unknown" as const,
			usageReporting: "unknown" as const,
		},
	};
}

export const PROGRESS_TIMEZONE = matiEnv("PROGRESS_TIMEZONE") ?? "UTC";
