import { type MatiProviderId, parseMatiProvider } from "@repo/ai/providers";
import { z } from "zod";

const MODEL_ID = /^[A-Za-z0-9._:-]{1,200}$/;

export class LlmSettingsInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LlmSettingsInputError";
	}
}

const saveSchema = z.object({
	provider: z.string(),
	model: z.string().min(1).max(200),
	apiKey: z.string().min(1).max(4096),
});

export interface ParsedLlmSettingsInput {
	apiKey: string;
	model: string;
	provider: MatiProviderId;
}

export function parseLlmSettingsInput(raw: unknown): ParsedLlmSettingsInput {
	if (!raw || typeof raw !== "object") {
		throw new LlmSettingsInputError("Invalid settings.");
	}
	const record = raw as Record<string, unknown>;
	if ("baseUrl" in record || "base_url" in record) {
		throw new LlmSettingsInputError(
			"Mati does not accept a base URL. Each provider uses its official endpoint."
		);
	}
	const parsed = saveSchema.safeParse(raw);
	if (!parsed.success) {
		throw new LlmSettingsInputError("Invalid settings.");
	}
	const provider = parseMatiProvider(parsed.data.provider);
	if (!provider) {
		throw new LlmSettingsInputError(
			"Unknown provider. Mati supports OpenAI, Anthropic, Sarvam AI, xAI Grok, and Google Gemini."
		);
	}
	const model = parsed.data.model.trim();
	if (!MODEL_ID.test(model) || model.includes("/")) {
		throw new LlmSettingsInputError(
			"Model must be the provider model name (no slash or URL)."
		);
	}
	return {
		provider,
		model,
		apiKey: parsed.data.apiKey,
	};
}
