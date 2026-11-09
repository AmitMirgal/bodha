import { NextResponse } from "next/server";
import { z } from "zod";
import { CURSOR_ADMIN_BINDING } from "../../../lib/capture/cursor-admin";
import {
	encryptionAvailable,
	encryptSecret,
} from "../../../lib/crypto/credentials";
import { withUserDb } from "../../../lib/db/client";
import { requireUser } from "../../../lib/supabase/server";

const bodySchema = z.object({
	apiKey: z.string().min(8).max(500),
});

export async function GET() {
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	const settings = await withUserDb(userId, (db) =>
		db.cursorAdminSettings.findFirst({
			select: { keyFingerprint: true },
			where: { userId },
		})
	);
	return NextResponse.json({
		encryptionReady: encryptionAvailable(),
		configured: Boolean(settings),
		keyFingerprint: settings?.keyFingerprint ?? null,
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
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
	}
	const parsed = bodySchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "API key is required." },
			{ status: 400 }
		);
	}
	const secret = encryptSecret(
		parsed.data.apiKey,
		userId,
		CURSOR_ADMIN_BINDING
	);
	await withUserDb(userId, (db) =>
		db.cursorAdminSettings.upsert({
			create: {
				encryptedApiKey: secret.ciphertext,
				encryptionIv: secret.iv,
				encryptionTag: secret.tag,
				keyFingerprint: secret.fingerprint,
				userId,
			},
			update: {
				encryptedApiKey: secret.ciphertext,
				encryptionIv: secret.iv,
				encryptionTag: secret.tag,
				keyFingerprint: secret.fingerprint,
			},
			where: { userId },
		})
	);
	return NextResponse.json({
		configured: true,
		keyFingerprint: secret.fingerprint,
	});
}

export async function DELETE() {
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	await withUserDb(userId, (db) =>
		db.cursorAdminSettings.deleteMany({ where: { userId } })
	);
	return NextResponse.json({ ok: true });
}
