import { probeOpenAiCompatible, validateLlmEndpoint } from "@repo/ai/provider";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
	encryptionAvailable,
	encryptSecret,
} from "../../../lib/crypto/credentials";
import { withUserDb } from "../../../lib/db/client";
import { deleteLlmSettings, upsertLlmSettings } from "../../../lib/db/queries";
import { allowHttpLlm, getAllowedLlmHosts } from "../../../lib/env";
import { redactProviderError } from "../../../lib/errors";
import { getMaskedSettings } from "../../../lib/llm/resolve-config";
import { requireUser } from "../../../lib/supabase/server";

const saveSchema = z.object({
	provider: z.string().min(1).max(64),
	model: z.string().min(1).max(200),
	baseUrl: z.string().url(),
	apiKey: z.string().min(1).max(4096),
});

export async function GET() {
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	const settings = await withUserDb(userId, (db) =>
		getMaskedSettings(db, userId)
	);
	return NextResponse.json({
		settings,
		encryptionReady: encryptionAvailable(),
		allowedHosts: getAllowedLlmHosts(),
	});
}

export async function PUT(request: Request) {
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	if (!encryptionAvailable()) {
		return NextResponse.json(
			{
				error:
					"Server encryption is not configured. Refusing to store credentials.",
			},
			{ status: 503 }
		);
	}
	const parsed = saveSchema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
	}
	try {
		const endpoint = await validateLlmEndpoint(
			parsed.data.baseUrl,
			getAllowedLlmHosts(),
			{ allowHttpForApprovedHosts: allowHttpLlm() }
		);
		const probe = await probeOpenAiCompatible(
			endpoint,
			parsed.data.apiKey,
			parsed.data.model
		);
		if (probe.capabilities.tools !== "supported") {
			return NextResponse.json(
				{
					error:
						probe.error ??
						"This endpoint has not proven tool calling. Settings were not saved.",
					capabilities: probe.capabilities,
				},
				{ status: 400 }
			);
		}
		const secret = encryptSecret(parsed.data.apiKey, userId, {
			provider: parsed.data.provider,
			model: parsed.data.model,
			baseUrl: endpoint.href,
		});
		await withUserDb(userId, (db) =>
			upsertLlmSettings(db, {
				userId,
				provider: parsed.data.provider,
				model: parsed.data.model,
				baseUrl: endpoint.href,
				encryptedApiKey: secret.ciphertext,
				encryptionIv: secret.iv,
				encryptionTag: secret.tag,
				keyFingerprint: secret.fingerprint,
				capabilities: probe.capabilities,
			})
		);
		return NextResponse.json({
			settings: {
				configured: true,
				source: "user",
				provider: parsed.data.provider,
				model: parsed.data.model,
				baseUrl: endpoint.href,
				keyFingerprint: secret.fingerprint,
				capabilities: probe.capabilities,
			},
		});
	} catch (error) {
		return NextResponse.json(
			{ error: redactProviderError(error) },
			{ status: 400 }
		);
	}
}

export async function DELETE() {
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	try {
		await withUserDb(userId, (db) => deleteLlmSettings(db, userId));
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json(
			{ error: "Could not remove settings." },
			{ status: 500 }
		);
	}
}

export async function POST(request: Request) {
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	const parsed = saveSchema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid settings for connection check." },
			{ status: 400 }
		);
	}
	try {
		const endpoint = await validateLlmEndpoint(
			parsed.data.baseUrl,
			getAllowedLlmHosts(),
			{ allowHttpForApprovedHosts: allowHttpLlm() }
		);
		const probe = await probeOpenAiCompatible(
			endpoint,
			parsed.data.apiKey,
			parsed.data.model
		);
		return NextResponse.json({
			ok: !probe.error,
			error: probe.error ?? null,
			capabilities: probe.capabilities,
			notice:
				"This check lists models and probes tool support. It does not send exercise content.",
		});
	} catch (error) {
		return NextResponse.json(
			{ error: redactProviderError(error) },
			{ status: 400 }
		);
	}
}
