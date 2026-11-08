const FALLBACK = "/";

export function safeNextPath(
	raw: string | null | undefined,
	fallback = FALLBACK,
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
