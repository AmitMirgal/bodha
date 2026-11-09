export class DatabaseUrlError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DatabaseUrlError";
	}
}

export const PRISMA_GENERATE_PLACEHOLDER =
	"postgresql://postgres:postgres@127.0.0.1:5432/postgres";

export const PASSWORD_ENCODE_HINT =
	"Percent-encode reserved password characters before they go in the URL (example: p@ss → p%40ss).";

const TRANSACTION_PORT = "6543";

export type PrismaCliKind = "generate" | "connecting" | "other";

export interface PrismaCliEnv {
	DIRECT_URL?: string;
}

const POSTGRES_SCHEME = /^postgres(?:ql)?:\/\//i;
const WHITESPACE = /\s/;

function authoritySection(raw: string): string {
	const withoutScheme = raw.replace(POSTGRES_SCHEME, "");
	return withoutScheme.split("/")[0]?.split("?")[0]?.split("#")[0] ?? "";
}

function unencodedAtCount(raw: string): number {
	return (authoritySection(raw).match(/@/g) ?? []).length;
}

export function encodeDbPassword(password: string): string {
	return encodeURIComponent(password);
}

export function parseMatiPostgresUrl(raw: string, label: string): URL {
	if (raw.startsWith("NEXT_PUBLIC_")) {
		throw new DatabaseUrlError(
			`${label} must not be a public browser variable.`
		);
	}
	if (!POSTGRES_SCHEME.test(raw)) {
		throw new DatabaseUrlError(
			`${label} must be a postgresql:// URL. ${PASSWORD_ENCODE_HINT}`
		);
	}
	if (WHITESPACE.test(raw) || raw.includes("#")) {
		throw new DatabaseUrlError(
			`${label} contains whitespace or '#', which break URL passwords. ${PASSWORD_ENCODE_HINT}`
		);
	}
	const atCount = unencodedAtCount(raw);
	if (atCount !== 1) {
		throw new DatabaseUrlError(
			`${label} has an unencoded reserved '@' in the user or password (${atCount} '@' in the host section). ${PASSWORD_ENCODE_HINT} Restart the app after editing .env.local.`
		);
	}
	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		throw new DatabaseUrlError(
			`${label} is not a valid URL. ${PASSWORD_ENCODE_HINT}`
		);
	}
	if (!parsed.hostname) {
		throw new DatabaseUrlError(
			`${label} is missing a hostname. ${PASSWORD_ENCODE_HINT}`
		);
	}
	return parsed;
}

export function withTransactionPoolerOptions(rawUrl: string): string {
	const parsed = parseMatiPostgresUrl(rawUrl, "DATABASE_URL");
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
		throw new DatabaseUrlError(
			"DATABASE_URL is missing. Set the transaction-mode pooler URL (port 6543) on the server. Do not expose it to the browser."
		);
	}
	return withTransactionPoolerOptions(rawUrl);
}

export function assertDirectUrl(rawUrl: string): string {
	return parseMatiPostgresUrl(rawUrl, "DIRECT_URL").toString();
}

function positionalCliTokens(argv: readonly string[]): string[] {
	return argv
		.flatMap((value) => value.split("="))
		.map((value) => value.toLowerCase())
		.filter((value) => value.length > 0 && !value.startsWith("-"));
}

function hasToken(tokens: readonly string[], name: string): boolean {
	return tokens.some((token) => token === name || token.endsWith(`/${name}`));
}

export function prismaCliKind(argv: readonly string[]): PrismaCliKind {
	const tokens = positionalCliTokens(argv);
	if (
		hasToken(tokens, "migrate") ||
		hasToken(tokens, "studio") ||
		hasToken(tokens, "introspect")
	) {
		return "connecting";
	}
	const dbIndex = tokens.findIndex(
		(token) => token === "db" || token.endsWith("/db")
	);
	if (dbIndex >= 0) {
		const sub = tokens[dbIndex + 1];
		if (
			sub === "pull" ||
			sub === "push" ||
			sub === "execute" ||
			sub === "seed"
		) {
			return "connecting";
		}
	}
	if (
		hasToken(tokens, "generate") ||
		hasToken(tokens, "format") ||
		hasToken(tokens, "validate")
	) {
		return "generate";
	}
	return "other";
}

const CONNECTING_CLI_HINT =
	"DIRECT_URL is required for Prisma migrate / db pull / db push. Set the session-mode pooler (port 5432). Generate can run without it. Mati schema changes are supabase/migrations/*.sql — do not prisma migrate against a Mati database.";

export function resolvePrismaCliDatasourceUrl(
	env: PrismaCliEnv,
	argv: readonly string[] = process.argv
): string {
	const kind = prismaCliKind(argv);
	const direct = env.DIRECT_URL;
	switch (kind) {
		case "connecting":
			if (!direct) {
				throw new DatabaseUrlError(CONNECTING_CLI_HINT);
			}
			return assertDirectUrl(direct);
		case "generate":
		case "other":
			if (!direct) {
				return PRISMA_GENERATE_PLACEHOLDER;
			}
			return assertDirectUrl(direct);
		default: {
			const exhaustive: never = kind;
			throw new DatabaseUrlError(
				`Unhandled Prisma CLI command kind: ${exhaustive}`
			);
		}
	}
}
