import "server-only";

import {
	type MaskedLlmSettings,
	parseProviderCapabilities,
	probeOpenAiCompatible,
	type ResolvedLlmConfig,
	validateLlmEndpoint,
} from "@repo/ai/provider";
import { decryptSecret, encryptionAvailable } from "../crypto/credentials";
import { getLlmSecrets, getMaskedLlmRow, hasLlmSettings } from "../db/queries";
import type { BodhaDb } from "../db/rls";
import { allowHttpLlm, getAllowedLlmHosts, getOperatorDefault } from "../env";

export class LlmConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LlmConfigError";
	}
}

function requireSupportedTools(
	value: unknown,
	label: string
): NonNullable<ReturnType<typeof parseProviderCapabilities>> {
	const capabilities = parseProviderCapabilities(value);
	if (!capabilities || capabilities.tools !== "supported") {
		throw new LlmConfigError(
			`${label} has not proven tool calling. Save settings after a successful connection check. BODHA will not fall back to a one-shot completion.`
		);
	}
	return capabilities;
}

export async function getMaskedSettings(
	db: BodhaDb,
	userId: string
): Promise<MaskedLlmSettings> {
	const data = await getMaskedLlmRow(db, userId);

	if (data) {
		return {
			configured: true,
			source: "user",
			provider: data.provider,
			model: data.model,
			baseUrl: data.baseUrl,
			keyFingerprint: data.keyFingerprint,
			capabilities: parseProviderCapabilities(data.capabilities),
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
			capabilities: parseProviderCapabilities(operator.capabilities),
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
	db: BodhaDb,
	userId: string
): Promise<{ config: ResolvedLlmConfig; apiKey: string }> {
	if (!encryptionAvailable() && (await hasLlmSettings(db, userId))) {
		throw new LlmConfigError(
			"Encryption key is not configured. Refusing to use stored credentials."
		);
	}

	const data = await getLlmSecrets(db, userId);

	if (data) {
		const apiKey = decryptSecret(
			{
				ciphertext: data.encryptedApiKey,
				iv: data.encryptionIv,
				tag: data.encryptionTag,
				fingerprint: data.keyFingerprint,
			},
			userId,
			{
				provider: data.provider,
				model: data.model,
				baseUrl: data.baseUrl,
			}
		);
		const endpoint = await validateLlmEndpoint(
			data.baseUrl,
			getAllowedLlmHosts(),
			{ allowHttpForApprovedHosts: allowHttpLlm() }
		);
		return {
			apiKey,
			config: {
				source: "user",
				protocol: "openai-compatible",
				provider: data.provider,
				model: data.model,
				baseUrl: endpoint.href,
				capabilities: requireSupportedTools(
					data.capabilities,
					"Saved settings"
				),
			},
		};
	}

	const operator = getOperatorDefault();
	if (!operator) {
		throw new LlmConfigError(
			"No LLM key is configured. Add your provider settings before chatting or generating a report."
		);
	}
	const endpoint = await validateLlmEndpoint(
		operator.baseUrl,
		getAllowedLlmHosts(),
		{ allowHttpForApprovedHosts: allowHttpLlm() }
	);
	const probe = await probeOpenAiCompatible(
		endpoint,
		operator.apiKey,
		operator.model
	);
	return {
		apiKey: operator.apiKey,
		config: {
			source: "operator_default",
			protocol: "openai-compatible",
			provider: operator.provider,
			model: operator.model,
			baseUrl: endpoint.href,
			capabilities: requireSupportedTools(
				probe.capabilities,
				"Operator default"
			),
		},
	};
}
