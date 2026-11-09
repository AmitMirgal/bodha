import {
	describeUnsupported,
	documentedCapabilitiesFor,
	publicProviderCatalog,
} from "@repo/ai/provider";
import { NextResponse } from "next/server";
import {
	encryptionAvailable,
	encryptSecret,
} from "../../../lib/crypto/credentials";
import { withUserDb } from "../../../lib/db/client";
import { deleteLlmSettings, upsertLlmSettings } from "../../../lib/db/queries";
import { redactProviderError } from "../../../lib/errors";
import { getMaskedSettings } from "../../../lib/llm/resolve-config";
import {
	LlmSettingsInputError,
	parseLlmSettingsInput,
} from "../../../lib/llm/settings-input";
import { requireUser } from "../../../lib/supabase/server";

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
		providers: publicProviderCatalog(),
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
	try {
		const parsed = parseLlmSettingsInput(await request.json());
		const capabilities = documentedCapabilitiesFor(parsed.provider);
		if (capabilities.tools !== "supported") {
			return NextResponse.json(
				{
					error:
						"This provider has not proven tool calling. Settings were not saved. Mati will not fall back to a one-shot completion.",
					capabilities,
					gaps: describeUnsupported(capabilities),
				},
				{ status: 400 }
			);
		}
		const secret = encryptSecret(parsed.apiKey, userId, {
			provider: parsed.provider,
			model: parsed.model,
		});
		await withUserDb(userId, (db) =>
			upsertLlmSettings(db, {
				userId,
				provider: parsed.provider,
				model: parsed.model,
				encryptedApiKey: secret.ciphertext,
				encryptionIv: secret.iv,
				encryptionTag: secret.tag,
				keyFingerprint: secret.fingerprint,
				capabilities,
			})
		);
		return NextResponse.json({
			settings: {
				configured: true,
				source: "user",
				provider: parsed.provider,
				model: parsed.model,
				keyFingerprint: secret.fingerprint,
				capabilities,
			},
			gaps: describeUnsupported(capabilities),
		});
	} catch (error) {
		if (error instanceof LlmSettingsInputError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}
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
	try {
		const parsed = parseLlmSettingsInput(await request.json());
		const capabilities = documentedCapabilitiesFor(parsed.provider);
		const gaps = describeUnsupported(capabilities);
		return NextResponse.json({
			ok: capabilities.tools === "supported",
			error:
				capabilities.tools === "supported"
					? null
					: "This provider has not proven tool calling. Mati will not fall back to a one-shot completion.",
			capabilities,
			gaps,
			notice:
				"This check uses the documented capability matrix. It does not send exercise content or call the provider with your key.",
		});
	} catch (error) {
		if (error instanceof LlmSettingsInputError) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}
		return NextResponse.json(
			{ error: redactProviderError(error) },
			{ status: 400 }
		);
	}
}
