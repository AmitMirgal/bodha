const DEFAULT_ORIGIN = "http://127.0.0.1:3000";
const TRAILING_SLASHES = /\/+$/;
const CREDENTIAL_URL = /\b\w+:\/\/[^/\s:]+:[^/\s@]+@\S+/g;
const BEARER = /Bearer\s+\S+/gi;

export function stripTrailingSlash(origin: string): string {
	return origin.replace(TRAILING_SLASHES, "");
}

export function resolveMatiOrigin(input: {
	envOrigin?: string | undefined;
	fallback?: string;
	secretOrigin?: string | undefined;
	settingOrigin?: string | undefined;
}): string {
	const chosen =
		input.envOrigin?.trim() ||
		input.settingOrigin?.trim() ||
		input.secretOrigin?.trim() ||
		input.fallback?.trim() ||
		DEFAULT_ORIGIN;
	return stripTrailingSlash(chosen);
}

export function redactNetworkMessage(message: string): string {
	return message
		.replace(CREDENTIAL_URL, "[redacted-url]")
		.replace(BEARER, "Bearer [redacted]");
}

export function describeFetchError(
	action: string,
	origin: string,
	cause: { kind: "http"; status: number } | { kind: "network"; message: string }
): string {
	if (cause.kind === "http") {
		return `Could not ${action} at ${origin} (HTTP ${cause.status}).`;
	}
	const detail = redactNetworkMessage(cause.message).trim() || "network error";
	return `Could not ${action} at ${origin} (${detail}).`;
}
