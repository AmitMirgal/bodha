import { Prisma } from "../../generated/prisma/client";
import { PersistenceError } from "../errors";

export type QueryError = { code?: string; message?: string } | null;

interface SavepointClient {
	$executeRawUnsafe: (sql: string) => Promise<unknown>;
}

export function isUniqueViolation(error: QueryError | unknown): boolean {
	if (!error || typeof error !== "object") {
		return false;
	}
	const code = (error as { code?: string }).code;
	return code === "23505" || code === "P2002";
}

export function isPrismaUnique(error: unknown): boolean {
	if (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === "P2002"
	) {
		return true;
	}
	if (
		error &&
		typeof error === "object" &&
		"code" in error &&
		(error as { code?: string }).code === "P2002"
	) {
		return true;
	}
	return isUniqueViolation(error);
}

/**
 * Insert-only idempotency for tables that must not receive UPDATE grants.
 * First write wins: create, and on unique violation select the existing row.
 * Uses a savepoint so a unique violation does not abort the outer RLS transaction.
 * Do not use Prisma upsert / ON CONFLICT DO UPDATE on immutable tables.
 */
export async function insertOnce<T>(
	db: SavepointClient,
	create: () => Promise<T>,
	findExisting: () => Promise<T | null>
): Promise<{ created: boolean; data: T }> {
	await db.$executeRawUnsafe("SAVEPOINT bodha_insert_once");
	try {
		const data = await create();
		await db.$executeRawUnsafe("RELEASE SAVEPOINT bodha_insert_once");
		return { created: true, data };
	} catch (error) {
		await db.$executeRawUnsafe("ROLLBACK TO SAVEPOINT bodha_insert_once");
		if (!isPrismaUnique(error)) {
			throw error instanceof PersistenceError ? error : new PersistenceError();
		}
		const existing = await findExisting();
		if (!existing) {
			throw new PersistenceError();
		}
		return { created: false, data: existing };
	}
}
