import { createHash, randomBytes } from "node:crypto";

export const DEVICE_TOKEN_PREFIX = "mati_dev_";
const BEARER = /^Bearer\s+(mati_dev_[0-9a-f]{64})$/i;

export function generateDeviceSecret(): string {
	return `${DEVICE_TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
}

export function hashDeviceSecret(secret: string): string {
	return createHash("sha256").update(secret).digest("hex");
}

export function parseDeviceBearer(header: string | null): string | null {
	if (!header) {
		return null;
	}
	const match = BEARER.exec(header.trim());
	return match?.[1] ?? null;
}
