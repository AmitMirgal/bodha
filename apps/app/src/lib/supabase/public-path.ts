const PUBLIC_PREFIXES = [
	"/login",
	"/auth/callback",
	"/auth/confirm",
	"/capture",
	"/api/capture",
	"/dev",
] as const;

export function isPublicPath(path: string): boolean {
	if (path === "/") {
		return true;
	}
	if (path.startsWith("/_next") || path.startsWith("/harness.js")) {
		return true;
	}
	return PUBLIC_PREFIXES.some(
		(prefix) => path === prefix || path.startsWith(`${prefix}/`)
	);
}
