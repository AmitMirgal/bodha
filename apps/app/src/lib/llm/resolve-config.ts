import "server-only";

import {
	DEFAULT_CAPABILITIES,
	type MaskedLlmSettings,
	type ResolvedLlmConfig,
	validateLlmEndpoint,
} from "@repo/ai/provider";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret, encryptionAvailable } from "../crypto/credentials";
import { getAllowedLlmHosts, getOperatorDefault } from "../env";

export class LlmConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LlmConfigError";
	}
}

interface LlmRow {
	base_url: string;
	encrypted_api_key: string;
	encryption_iv: string;
	encryption_tag: string;
	key_fingerprint: string;
	model: string;
	provider: string;
}

export async function getMaskedSettings(
	supabase: SupabaseClient,
	userId: string,
): Promise<MaskedLlmSettings> {
	const { data } = await supabase
		.from("llm_settings_status")
		.select("provider, model, base_url, key_fingerprint")
		.eq("user_id", userId)
		.maybeSingle();

	if (data) {
		return {
			configured: true,
			source: "user",
			provider: data.provider,
			model: data.model,
			baseUrl: data.base_url,
			keyFingerprint: data.key_fingerprint,
			capabilities: DEFAULT_CAPABILITIES,
		};
	}

	const operator = getOperatorDefault();
	if (operator) {
		return {
			configured: true,
			source: "operator_default",
			provider: operator.provider,
			model: operator.model,
			baseUrl: operator.baseUrl,
			keyFingerprint: "operator-env",
			capabilities: DEFAULT_CAPABILITIES,
		};
	}

	return {
		configured: false,
		source: "none",
		provider: null,
		model: null,
		baseUrl: null,
		keyFingerprint: null,
		capabilities: null,
	};
}

export async function resolveLlmForUser(
	supabase: SupabaseClient,
	userId: string,
): Promise<{ config: ResolvedLlmConfig; apiKey: string }> {
	if (!encryptionAvailable() && (await hasUserSettings(supabase, userId))) {
		throw new LlmConfigError(
			"Encryption key is not configured. Refusing to use stored credentials.",
		);
	}

	const { data, error } = await supabase
		.from("llm_settings")
		.select(
			"provider, model, base_url, encrypted_api_key, encryption_iv, encryption_tag, key_fingerprint",
		)
		.eq("user_id", userId)
		.maybeSingle();

	if (error) {
		throw new LlmConfigError("Could not load LLM settings.");
	}

	if (data) {
		const row = data as LlmRow;
		const apiKey = decryptSecret(
			{
				ciphertext: row.encrypted_api_key,
				iv: row.encryption_iv,
				tag: row.encryption_tag,
				fingerprint: row.key_fingerprint,
			},
			userId,
		);
		const endpoint = await validateLlmEndpoint(
			row.base_url,
			getAllowedLlmHosts(),
		);
		return {
			apiKey,
			config: {
				source: "user",
				protocol: "openai-compatible",
				provider: row.provider,
				model: row.model,
				baseUrl: endpoint.href,
				capabilities: DEFAULT_CAPABILITIES,
			},
		};
	}

	const operator = getOperatorDefault();
	if (!operator) {
		throw new LlmConfigError(
			"No LLM key is configured. Add your provider settings before chatting or generating a report.",
		);
	}
	const endpoint = await validateLlmEndpoint(
		operator.baseUrl,
		getAllowedLlmHosts(),
	);
	return {
		apiKey: operator.apiKey,
		config: {
			source: "operator_default",
			protocol: "openai-compatible",
			provider: operator.provider,
			model: operator.model,
			baseUrl: endpoint.href,
			capabilities: DEFAULT_CAPABILITIES,
		},
	};
}

async function hasUserSettings(supabase: SupabaseClient, userId: string) {
	const { data } = await supabase
		.from("llm_settings_status")
		.select("user_id")
		.eq("user_id", userId)
		.maybeSingle();
	return Boolean(data);
}
