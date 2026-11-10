import { createHash, randomBytes } from "node:crypto";
import type { MatiDb } from "../db/rls";
import { PairingError } from "./pair";

export const DEVICE_CLAIM_TTL_MS = 10 * 60 * 1000;

export function hashDeviceClaimToken(token: string): string {
	return createHash("sha256").update(token.trim()).digest("hex");
}

export function generateDeviceClaimToken(): string {
	return randomBytes(32).toString("hex");
}

export function requestSameOrigin(request: Request): boolean {
	const origin = request.headers.get("origin");
	if (!origin) {
		return true;
	}
	try {
		return origin === new URL(request.url).origin;
	} catch {
		return false;
	}
}

export async function startDeviceClaim(
	db: MatiDb,
	deviceId: string,
	now = new Date()
): Promise<{ expiresAt: string; token: string }> {
	await db.deviceClaimToken.updateMany({
		data: { consumedAt: now },
		where: { consumedAt: null, deviceId },
	});
	const token = generateDeviceClaimToken();
	const expiresAt = new Date(now.getTime() + DEVICE_CLAIM_TTL_MS);
	await db.deviceClaimToken.create({
		data: {
			deviceId,
			expiresAt,
			tokenHash: hashDeviceClaimToken(token),
		},
	});
	return { expiresAt: expiresAt.toISOString(), token };
}

export async function claimDeviceWithToken(
	db: MatiDb,
	userId: string,
	token: string
): Promise<{ deviceId: string }> {
	const tokenHash = hashDeviceClaimToken(token);
	const consumed = await db.$queryRaw<Array<{ device_id: string | null }>>`
    SELECT public.mati_claim_device_with_token(${tokenHash}, ${userId}::uuid)::text AS device_id`;
	const deviceId = consumed[0]?.device_id;
	if (!deviceId) {
		throw new PairingError(
			"That claim link is invalid, expired, or already used.",
			400,
			"invalid_code"
		);
	}
	return { deviceId };
}
