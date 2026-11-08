import { probeOpenAiCompatible, validateLlmEndpoint } from "@repo/ai/provider";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
	encryptionAvailable,
	encryptSecret,
} from "../../../lib/crypto/credentials";
import { getAllowedLlmHosts } from "../../../lib/env";
import { getMaskedSettings } from "../../../lib/llm/resolve-config";
import { requireUser } from "../../../lib/supabase/server";

const saveSchema = z.object({
	provider: z.string().min(1).max(64),
	model: z.string().min(1).max(200),
	baseUrl: z.string().url(),
	apiKey: z.string().min(1).max(4096),
});

export async function GET() {
	const { supabase, userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	const settings = await getMaskedSettings(supabase, userId);
	return NextResponse.json({
		settings,
		encryptionReady: encryptionAvailable(),
		allowedHosts: getAllowedLlmHosts(),
	});
}

export async function PUT(request: Request) {
	const { supabase, userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	if (!encryptionAvailable()) {
		return NextResponse.json(
			{
				error:
					"Server encryption is not configured. Refusing to store credentials.",
			},
			{ status: 503 },
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
		);
		const secret = encryptSecret(parsed.data.apiKey, userId);
		const { error } = await supabase.from("llm_settings").upsert({
			user_id: userId,
			provider: parsed.data.provider,
			model: parsed.data.model,
			base_url: endpoint.href,
			encrypted_api_key: secret.ciphertext,
			encryption_iv: secret.iv,
			encryption_tag: secret.tag,
			key_fingerprint: secret.fingerprint,
			updated_at: new Date().toISOString(),
		});
		if (error) {
			return NextResponse.json(
				{ error: "Could not save settings." },
				{ status: 500 },
			);
		}
		return NextResponse.json({
			settings: {
				configured: true,
				source: "user",
				provider: parsed.data.provider,
				model: parsed.data.model,
				baseUrl: endpoint.href,
				keyFingerprint: secret.fingerprint,
			},
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Could not save settings.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}

export async function DELETE() {
	const { supabase, userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	const { error } = await supabase
		.from("llm_settings")
		.delete()
		.eq("user_id", userId);
	if (error) {
		return NextResponse.json(
			{ error: "Could not remove settings." },
			{ status: 500 },
		);
	}
	return NextResponse.json({ ok: true });
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
			{ status: 400 },
		);
	}
	try {
		const endpoint = await validateLlmEndpoint(
			parsed.data.baseUrl,
			getAllowedLlmHosts(),
		);
		const probe = await probeOpenAiCompatible(
			endpoint,
			parsed.data.apiKey,
			parsed.data.model,
		);
		return NextResponse.json({
			ok: !probe.error,
			error: probe.error ?? null,
			capabilities: probe.capabilities,
			notice:
				"This check lists models only. It does not send exercise content.",
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Connection check failed.";
		return NextResponse.json({ error: message }, { status: 400 });
	}
}
