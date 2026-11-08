import type { Prisma, PrismaClient } from "../../generated/prisma/client";

const UUID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RlsRole = "authenticated" | "anon";

export type VerifiedIdentity =
	| { role: "authenticated"; userId: string }
	| { role: "anon" };

export type BodhaDb = Prisma.TransactionClient;

export type RunWithDb = <T>(
	identity: VerifiedIdentity,
	fn: (db: BodhaDb) => Promise<T>
) => Promise<T>;

const ROLES: Record<RlsRole, RlsRole> = {
	authenticated: "authenticated",
	anon: "anon",
};

export class RlsContextError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RlsContextError";
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
	const exhaustive: never = identity;
	throw new RlsContextError(
		`Unhandled RLS identity: ${JSON.stringify(exhaustive)}`
	);
}

export async function applyRlsContext(
	db: BodhaDb,
	identity: VerifiedIdentity
): Promise<void> {
	const safe = assertIdentity(identity);
	const claims =
		safe.role === "authenticated"
			? JSON.stringify({ sub: safe.userId, role: "authenticated" })
			: JSON.stringify({ role: "anon" });
	const sub = safe.role === "authenticated" ? safe.userId : "";
	await db.$executeRaw`SELECT set_config('request.jwt.claims', ${claims}, true)`;
	await db.$executeRaw`SELECT set_config('request.jwt.claim.sub', ${sub}, true)`;
	const role = ROLES[safe.role];
	await db.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
	const rows = await db.$queryRaw<
		Array<{ role_name: string; super: string; uid: string | null }>
	>`SELECT current_user::text AS role_name, current_setting('is_superuser') AS super, auth.uid()::text AS uid`;
	const row = rows[0];
	if (!row || row.role_name !== role || row.super === "on") {
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
}

export function createRunWithDb(prisma: PrismaClient): RunWithDb {
	return async (identity, fn) => {
		return await prisma.$transaction(async (tx) => {
			await applyRlsContext(tx, identity);
			return fn(tx);
		});
	};
}

export async function withUserDb<T>(
	prisma: PrismaClient,
	userId: string,
	fn: (db: BodhaDb) => Promise<T>
): Promise<T> {
	return await createRunWithDb(prisma)({ role: "authenticated", userId }, fn);
}

export async function withAnonDb<T>(
	prisma: PrismaClient,
	fn: (db: BodhaDb) => Promise<T>
): Promise<T> {
	return await createRunWithDb(prisma)({ role: "anon" }, fn);
}
