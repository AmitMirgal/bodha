import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { readPrismaTransactionOptions } from "./connect-options";

const UUID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RlsRole = "authenticated" | "anon" | "device" | "capture_register";

export type VerifiedIdentity =
	| { role: "authenticated"; userId: string }
	| { role: "anon" }
	| { role: "device"; deviceId: string }
	| { role: "capture_register" };

export type MatiDb = Prisma.TransactionClient;

export type RunWithDb = <T>(
	identity: VerifiedIdentity,
	fn: (db: MatiDb) => Promise<T>
) => Promise<T>;

const ROLES: Record<RlsRole, RlsRole> = {
	authenticated: "authenticated",
	anon: "anon",
	device: "device",
	capture_register: "capture_register",
};

function pgBool(value: unknown): boolean {
	return value === true || value === "t" || value === "true" || value === "on";
}

export class RlsContextError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RlsContextError";
	}
}

export class DatabaseTransactionError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "DatabaseTransactionError";
	}
}

export const TRANSACTION_START_HINT =
	"Could not start a database transaction in time. Percent-encode reserved password characters (example: p@ss → p%40ss) in DATABASE_URL and DIRECT_URL, then restart. If the database is far from this machine, raise MATI_PRISMA_TX_MAX_WAIT_MS and MATI_PG_CONNECTION_TIMEOUT_MS. This is not an anonymous-auth setting.";

function prismaErrorCode(error: unknown): string | undefined {
	if (!(error && typeof error === "object" && "code" in error)) {
		return undefined;
	}
	const { code } = error;
	return typeof code === "string" ? code : undefined;
}

const CONNECT_TIMEOUT =
	/timeout expired|connection terminated due to connection timeout|timeout exceeded when trying to connect|connect etimedout/i;

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function isConnectTimeout(error: unknown): boolean {
	return CONNECT_TIMEOUT.test(errorMessage(error));
}

export function mapPrismaTransactionError(error: unknown): never {
	if (error instanceof RlsContextError) {
		throw error;
	}
	if (error instanceof DatabaseTransactionError) {
		throw error;
	}
	if (prismaErrorCode(error) === "P2028" || isConnectTimeout(error)) {
		throw new DatabaseTransactionError(TRANSACTION_START_HINT, {
			cause: error,
		});
	}
	throw error;
}

function claimsFor(identity: VerifiedIdentity): string {
	switch (identity.role) {
		case "authenticated":
			return JSON.stringify({ sub: identity.userId, role: "authenticated" });
		case "anon":
			return JSON.stringify({ role: "anon" });
		case "device":
			return JSON.stringify({ role: "device", device_id: identity.deviceId });
		case "capture_register":
			return JSON.stringify({ role: "capture_register" });
		default: {
			const exhaustive: never = identity;
			throw new RlsContextError(
				`Unhandled RLS identity: ${JSON.stringify(exhaustive)}`
			);
		}
	}
}

function assertIdentity(identity: VerifiedIdentity): VerifiedIdentity {
	if (identity.role === "authenticated") {
		if (!UUID.test(identity.userId)) {
			throw new RlsContextError(
				"Verified user id is required for authenticated Prisma access."
			);
		}
		return identity;
	}
	if (identity.role === "anon") {
		return identity;
	}
	if (identity.role === "device") {
		if (!UUID.test(identity.deviceId)) {
			throw new RlsContextError(
				"Verified device id is required for device Prisma access."
			);
		}
		return identity;
	}
	if (identity.role === "capture_register") {
		return identity;
	}
	const exhaustive: never = identity;
	throw new RlsContextError(
		`Unhandled RLS identity: ${JSON.stringify(exhaustive)}`
	);
}

export async function applyRlsContext(
	db: MatiDb,
	identity: VerifiedIdentity
): Promise<void> {
	const safe = assertIdentity(identity);
	const claims = claimsFor(safe);
	const sub = safe.role === "authenticated" ? safe.userId : "";
	await db.$executeRaw`SELECT set_config('request.jwt.claims', ${claims}, true)`;
	await db.$executeRaw`SELECT set_config('request.jwt.claim.sub', ${sub}, true)`;
	const role = ROLES[safe.role];
	await db.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
	const rows = await db.$queryRaw<
		Array<{
			role_name: string;
			super: string;
			uid: string | null;
			rolsuper: unknown;
			rolbypassrls: unknown;
		}>
	>`SELECT current_user::text AS role_name,
    current_setting('is_superuser') AS super,
    auth.uid()::text AS uid,
    r.rolsuper AS rolsuper,
    r.rolbypassrls AS rolbypassrls
    FROM pg_roles r
    WHERE r.rolname = current_user`;
	const row = rows[0];
	// FORCE ROW LEVEL SECURITY does not constrain BYPASSRLS roles. Fail closed
	// on pg_roles.rolbypassrls, not only is_superuser / current_user.
	if (
		!row ||
		row.role_name !== role ||
		row.super === "on" ||
		pgBool(row.rolsuper) ||
		pgBool(row.rolbypassrls)
	) {
		throw new RlsContextError(
			"Refusing to run product queries: SET LOCAL ROLE did not drop to a non-bypass RLS role."
		);
	}
	if (safe.role === "authenticated" && row.uid !== safe.userId) {
		throw new RlsContextError(
			"Refusing to run product queries: auth.uid() does not match the verified user."
		);
	}
	if (safe.role === "anon" && row.uid) {
		throw new RlsContextError(
			"Refusing anonymous Prisma access while auth.uid() is set."
		);
	}
	if ((safe.role === "device" || safe.role === "capture_register") && row.uid) {
		throw new RlsContextError(
			"Refusing device Prisma access while auth.uid() is set."
		);
	}
	if (safe.role === "device") {
		const deviceRows = await db.$queryRaw<Array<{ device_id: string | null }>>`
      SELECT public.mati_device_id()::text AS device_id`;
		if (deviceRows[0]?.device_id !== safe.deviceId) {
			throw new RlsContextError(
				"Refusing to run product queries: mati_device_id() does not match the verified device."
			);
		}
	}
}

export function createRunWithDb(prisma: PrismaClient): RunWithDb {
	return async (identity, fn) => {
		try {
			return await prisma.$transaction(async (tx) => {
				await applyRlsContext(tx, identity);
				return fn(tx);
			}, readPrismaTransactionOptions());
		} catch (error) {
			mapPrismaTransactionError(error);
		}
	};
}

export async function withUserDb<T>(
	prisma: PrismaClient,
	userId: string,
	fn: (db: MatiDb) => Promise<T>
): Promise<T> {
	return await createRunWithDb(prisma)({ role: "authenticated", userId }, fn);
}

export async function withAnonDb<T>(
	prisma: PrismaClient,
	fn: (db: MatiDb) => Promise<T>
): Promise<T> {
	return await createRunWithDb(prisma)({ role: "anon" }, fn);
}

export async function withDeviceDb<T>(
	prisma: PrismaClient,
	deviceId: string,
	fn: (db: MatiDb) => Promise<T>
): Promise<T> {
	return await createRunWithDb(prisma)({ role: "device", deviceId }, fn);
}

export async function withCaptureRegisterDb<T>(
	prisma: PrismaClient,
	fn: (db: MatiDb) => Promise<T>
): Promise<T> {
	return await createRunWithDb(prisma)({ role: "capture_register" }, fn);
}
