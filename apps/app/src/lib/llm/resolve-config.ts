import "server-only";

import {
	documentedCapabilitiesFor,
	type MaskedLlmSettings,
	parseProviderCapabilities,
	type ResolvedLlmConfig,
	requireMatiProvider,
} from "@repo/ai/provider";
import { decryptSecret, encryptionAvailable } from "../crypto/credentials";
import { getLlmSecrets, getMaskedLlmRow, hasLlmSettings } from "../db/queries";
import type { MatiDb } from "../db/rls";
import { getOperatorDefault } from "../env";

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
			`${label} has not proven tool calling. Save settings after a successful connection check. Mati will not fall back to a one-shot completion.`
		);
	}
	return capabilities;
}

export async function getMaskedSettings(
	db: MatiDb,
	userId: string
): Promise<MaskedLlmSettings> {
	const data = await getMaskedLlmRow(db, userId);

	if (data) {
		return {
			configured: true,
			source: "user",
			provider: data.provider,
			model: data.model,
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
			keyFingerprint: "operator-env",
			capabilities: documentedCapabilitiesFor(operator.provider),
		};
	}

	return {
		configured: false,
		source: "none",
		provider: null,
		model: null,
		keyFingerprint: null,
		capabilities: null,
	};
}

export async function resolveLlmForUser(
	db: MatiDb,
	userId: string
): Promise<{ config: ResolvedLlmConfig; apiKey: string }> {
	if (!encryptionAvailable() && (await hasLlmSettings(db, userId))) {
		throw new LlmConfigError(
			"Encryption key is not configured. Refusing to use stored credentials."
		);
	}

	const data = await getLlmSecrets(db, userId);

	if (data) {
		const provider = requireMatiProvider(data.provider);
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
				legacyBaseUrl: data.baseUrl,
			}
		);
		return {
			apiKey,
			config: {
				source: "user",
				provider: provider.id,
				model: data.model,
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
	const capabilities = documentedCapabilitiesFor(operator.provider);
	return {
		apiKey: operator.apiKey,
		config: {
			source: "operator_default",
			provider: operator.provider,
			model: operator.model,
			capabilities: requireSupportedTools(capabilities, "Operator default"),
		},
	};
}
