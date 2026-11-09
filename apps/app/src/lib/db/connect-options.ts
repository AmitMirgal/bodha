export const DEFAULT_TX_MAX_WAIT_MS = 15_000;
export const DEFAULT_TX_TIMEOUT_MS = 20_000;
export const DEFAULT_PG_CONNECTION_TIMEOUT_MS = 10_000;
export const DEFAULT_PG_IDLE_TIMEOUT_MS = 30_000;
export const DEFAULT_PG_POOL_MAX = 5;

export interface PgPoolConnectOptions {
	connectionTimeoutMillis: number;
	idleTimeoutMillis: number;
	max: number;
}

export interface PrismaInteractiveTransactionOptions {
	maxWait: number;
	timeout: number;
}

const POSITIVE_INT = /^[0-9]+$/;

function envString(env: object, key: string): string | undefined {
	const value = Reflect.get(env, key);
	return typeof value === "string" ? value : undefined;
}

function envPref(env: object, suffix: string): string | undefined {
	return envString(env, `MATI_${suffix}`);
}

function readPositiveInt(
	raw: string | undefined,
	fallback: number,
	label: string
): number {
	if (raw === undefined || raw.trim() === "") {
		return fallback;
	}
	const trimmed = raw.trim();
	if (!POSITIVE_INT.test(trimmed)) {
		throw new Error(`${label} must be a positive integer.`);
	}
	const value = Number(trimmed);
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw new Error(`${label} must be a positive integer.`);
	}
	return value;
}

export function readPrismaTransactionOptions(
	env: object = process.env
): PrismaInteractiveTransactionOptions {
	return {
		maxWait: readPositiveInt(
			envPref(env, "PRISMA_TX_MAX_WAIT_MS"),
			DEFAULT_TX_MAX_WAIT_MS,
			"MATI_PRISMA_TX_MAX_WAIT_MS"
		),
		timeout: readPositiveInt(
			envPref(env, "PRISMA_TX_TIMEOUT_MS"),
			DEFAULT_TX_TIMEOUT_MS,
			"MATI_PRISMA_TX_TIMEOUT_MS"
		),
	};
}

export function readPgPoolConnectOptions(
	env: object = process.env
): PgPoolConnectOptions {
	return {
		max: readPositiveInt(
			envPref(env, "PG_POOL_MAX"),
			DEFAULT_PG_POOL_MAX,
			"MATI_PG_POOL_MAX"
		),
		connectionTimeoutMillis: readPositiveInt(
			envPref(env, "PG_CONNECTION_TIMEOUT_MS"),
			DEFAULT_PG_CONNECTION_TIMEOUT_MS,
			"MATI_PG_CONNECTION_TIMEOUT_MS"
		),
		idleTimeoutMillis: readPositiveInt(
			envPref(env, "PG_IDLE_TIMEOUT_MS"),
			DEFAULT_PG_IDLE_TIMEOUT_MS,
			"MATI_PG_IDLE_TIMEOUT_MS"
		),
	};
}
