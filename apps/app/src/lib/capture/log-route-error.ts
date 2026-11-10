const SECRET_PATTERN =
	/(postgresql:\/\/\S+|postgres:\/\/\S+|Bearer\s+\S+|sb_secret_\S+|sb_publishable_\S+)/gi;

export function captureRouteErrorFields(error: unknown): {
	code: string | undefined;
	message: string;
	name: string;
} {
	const name = error instanceof Error ? error.name : "Error";
	const message = error instanceof Error ? error.message : String(error);
	let code: string | undefined;
	if (error && typeof error === "object" && "code" in error) {
		const raw = (error as { code: unknown }).code;
		if (typeof raw === "string" || typeof raw === "number") {
			code = String(raw);
		}
	}
	return {
		code,
		message: message.replace(SECRET_PATTERN, "[redacted]"),
		name,
	};
}

export function logCaptureRouteError(route: string, error: unknown): void {
	const fields = captureRouteErrorFields(error);
	if (fields.code) {
		console.error(
			`[capture] ${route}: ${fields.name} ${fields.code}: ${fields.message}`
		);
		return;
	}
	console.error(`[capture] ${route}: ${fields.name}: ${fields.message}`);
}
