const TRANSACTION_PORT = "6543";

export function encodeDbPassword(password: string): string {
	return encodeURIComponent(password);
}

export function withTransactionPoolerOptions(rawUrl: string): string {
	const parsed = new URL(rawUrl);
	if (
		parsed.port === TRANSACTION_PORT &&
		!parsed.searchParams.has("pgbouncer")
	) {
		parsed.searchParams.set("pgbouncer", "true");
	}
	return parsed.toString();
}

export function assertServerDatabaseUrl(rawUrl: string | undefined): string {
	if (!rawUrl) {
		throw new Error(
			"DATABASE_URL is missing. Set the transaction-mode pooler URL (port 6543) on the server. Do not expose it to the browser."
		);
	}
	if (rawUrl.startsWith("NEXT_PUBLIC_")) {
		throw new Error("Database URLs must not be public browser variables.");
	}
	return withTransactionPoolerOptions(rawUrl);
}
