import { createHmac, timingSafeEqual } from "node:crypto";
import { matiEnv } from "../mati-env";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const HEX64 = /^[0-9a-f]{64}$/i;

export function captureViewerSecret(env: object = process.env): string | null {
	const value = matiEnv("CAPTURE_VIEWER_SECRET", env);
	if (!(value && HEX64.test(value))) {
		return null;
	}
	return value;
}

export function signViewerToken(
	deviceId: string,
	secret: string,
	now = Date.now()
): string {
	const exp = String(now + SEVEN_DAYS_MS);
	const body = `${deviceId}.${exp}`;
	const mac = createHmac("sha256", secret).update(body).digest("hex");
	return `${exp}.${mac}`;
}

export function verifyViewerToken(
	deviceId: string,
	token: string,
	secret: string,
	now = Date.now()
): boolean {
	const parts = token.split(".");
	if (parts.length !== 2) {
		return false;
	}
	const [exp, mac] = parts;
	if (!(exp && mac)) {
		return false;
	}
	const expires = Number(exp);
	if (!Number.isFinite(expires) || expires < now) {
		return false;
	}
	const expected = createHmac("sha256", secret)
		.update(`${deviceId}.${exp}`)
		.digest("hex");
	const a = Buffer.from(mac);
	const b = Buffer.from(expected);
	if (a.length !== b.length) {
		return false;
	}
	return timingSafeEqual(a, b);
}
