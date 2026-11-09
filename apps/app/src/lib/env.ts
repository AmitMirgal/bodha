import { parseMatiProvider } from "@repo/ai/providers";
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

export function getOperatorDefault() {
	const provider = parseMatiProvider(matiEnv("OPERATOR_LLM_PROVIDER")?.trim());
	const model = matiEnv("OPERATOR_LLM_MODEL")?.trim();
	const apiKey = matiEnv("OPERATOR_LLM_API_KEY")?.trim();
	if (!(provider && model && apiKey)) {
		return null;
	}
	return {
		provider,
		model,
		apiKey,
		source: "operator_default" as const,
	};
}

export const PROGRESS_TIMEZONE = matiEnv("PROGRESS_TIMEZONE") ?? "UTC";
