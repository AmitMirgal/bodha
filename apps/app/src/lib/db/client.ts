import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import type { PrismaClient } from "../../generated/prisma/client";
import {
	readPgPoolConnectOptions,
	readPrismaTransactionOptions,
} from "./connect-options";
import { createPrismaClient } from "./factory";
import { type BodhaDb, createRunWithDb, type RunWithDb } from "./rls";
import { assertServerDatabaseUrl } from "./urls";

const globalForPrisma = globalThis as unknown as {
	bodhaPrisma?: PrismaClient;
};

export function getRuntimePrisma(): PrismaClient {
	if (!globalForPrisma.bodhaPrisma) {
		const connectionString = assertServerDatabaseUrl(process.env.DATABASE_URL);
		const pool = readPgPoolConnectOptions();
		globalForPrisma.bodhaPrisma = createPrismaClient(
			new PrismaPg({
				connectionString,
				connectionTimeoutMillis: pool.connectionTimeoutMillis,
				idleTimeoutMillis: pool.idleTimeoutMillis,
				max: pool.max,
			}),
			{ transactionOptions: readPrismaTransactionOptions() }
		);
	}
	return globalForPrisma.bodhaPrisma;
}

export function runtimeRunWithDb(): RunWithDb {
	return createRunWithDb(getRuntimePrisma());
}

export async function withUserDb<T>(
	userId: string,
	fn: (db: BodhaDb) => Promise<T>
): Promise<T> {
	return await runtimeRunWithDb()({ role: "authenticated", userId }, fn);
}

export async function withAnonDb<T>(
	fn: (db: BodhaDb) => Promise<T>
): Promise<T> {
	return await runtimeRunWithDb()({ role: "anon" }, fn);
}
