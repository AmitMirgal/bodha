import { DEFAULT_POST_LOGIN_PATH } from "./post-login";

const FALLBACK = DEFAULT_POST_LOGIN_PATH;

export function safeNextPath(
	raw: string | null | undefined,
	fallback = FALLBACK
): string {
	if (!raw) {
		return fallback;
	}
	if (!raw.startsWith("/")) {
		return fallback;
	}
	if (raw.startsWith("//") || raw.startsWith("/\\")) {
		return fallback;
	}
	if (raw.includes("://") || raw.includes("\\")) {
		return fallback;
	}
	return raw;
}
