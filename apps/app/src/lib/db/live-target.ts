import {
	DatabaseUrlError,
	parseBodhaPostgresUrl,
	withTransactionPoolerOptions,
} from "./urls";

const UUID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROD_HINT = /prod/i;
const POOLER_HOST = /(?:^|\.)pooler\.supabase\.com$/i;
const TRANSACTION_PORT = "6543";

export interface LivePrismaTargetEnv {
	BODHA_LIVE_ISOLATED_TARGET?: string;
	BODHA_LIVE_PRISMA_RLS?: string;
	BODHA_LIVE_USER_A_ID?: string;
	BODHA_LIVE_USER_B_ID?: string;
	DATABASE_URL?: string;
	[key: string]: string | undefined;
}

export type LivePrismaTarget =
	| { kind: "refused"; reason: string }
	| { kind: "skipped"; reason: string }
	| {
			connectionString: string;
			kind: "ready";
			userAId: string;
			userBId: string;
	  };

export const LIVE_PRISMA_SKIPPED_REASON =
	"Live PrismaPg / Supabase transaction-pooler RLS suite was not executed. Opt in only with BODHA_LIVE_PRISMA_RLS=1, BODHA_LIVE_ISOLATED_TARGET=1, an isolated DATABASE_URL on port 6543, and distinct BODHA_LIVE_USER_A_ID / BODHA_LIVE_USER_B_ID. Default CI does not open a remote database.";

function refuse(reason: string): LivePrismaTarget {
	return { kind: "refused", reason: `${reason} No connection was opened.` };
}

export function inspectLivePrismaTarget(
	env: LivePrismaTargetEnv
): LivePrismaTarget {
	if (env.BODHA_LIVE_PRISMA_RLS !== "1") {
		return { kind: "skipped", reason: LIVE_PRISMA_SKIPPED_REASON };
	}
	if (env.BODHA_LIVE_ISOLATED_TARGET !== "1") {
		return refuse(
			"Refusing live PrismaPg: set BODHA_LIVE_ISOLATED_TARGET=1 to confirm a throwaway non-production project."
		);
	}
	const raw = env.DATABASE_URL;
	if (!raw) {
		return refuse("Refusing live PrismaPg: DATABASE_URL is missing.");
	}
	if (raw.startsWith("NEXT_PUBLIC_")) {
		return refuse(
			"Refusing live PrismaPg: database URLs must not be public browser variables."
		);
	}
	let parsed: URL;
	try {
		parsed = parseBodhaPostgresUrl(raw, "DATABASE_URL");
	} catch (error) {
		if (error instanceof DatabaseUrlError) {
			return refuse(`Refusing live PrismaPg: ${error.message}`);
		}
		throw error;
	}
	const haystack = `${parsed.hostname} ${parsed.username} ${parsed.pathname}`;
	if (PROD_HINT.test(haystack)) {
		return refuse(
			"Refusing live PrismaPg: DATABASE_URL looks like a production target."
		);
	}
	if (parsed.port !== TRANSACTION_PORT) {
		return refuse(
			"Refusing live PrismaPg: isolated live checks require the transaction-mode pooler (port 6543)."
		);
	}
	if (!POOLER_HOST.test(parsed.hostname)) {
		return refuse(
			"Refusing live PrismaPg: host must be a Supabase pooler on an isolated project."
		);
	}
	const userAId = env.BODHA_LIVE_USER_A_ID ?? "";
	const userBId = env.BODHA_LIVE_USER_B_ID ?? "";
	if (!(UUID.test(userAId) && UUID.test(userBId)) || userAId === userBId) {
		return refuse(
			"Refusing live PrismaPg: BODHA_LIVE_USER_A_ID and BODHA_LIVE_USER_B_ID must be distinct UUIDs of users on that isolated project."
		);
	}
	return {
		kind: "ready",
		connectionString: withTransactionPoolerOptions(raw),
		userAId,
		userBId,
	};
}
