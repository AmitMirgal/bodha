import { z } from "zod";

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
			"Supabase public config is missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
		);
	}
	return {
		url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
		publishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
	};
}

export function getAllowedLlmHosts(): string[] {
	return (process.env.BODHA_ALLOWED_LLM_HOSTS ?? "")
		.split(",")
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean);
}

export function getOperatorDefault() {
	const provider = process.env.BODHA_OPERATOR_LLM_PROVIDER?.trim();
	const model = process.env.BODHA_OPERATOR_LLM_MODEL?.trim();
	const baseUrl = process.env.BODHA_OPERATOR_LLM_BASE_URL?.trim();
	const apiKey = process.env.BODHA_OPERATOR_LLM_API_KEY?.trim();
	if (!(provider && model && baseUrl && apiKey)) {
		return null;
	}
	return {
		provider,
		model,
		baseUrl,
		apiKey,
		source: "operator_default" as const,
	};
}

export const PROGRESS_TIMEZONE = process.env.BODHA_PROGRESS_TIMEZONE ?? "UTC";
