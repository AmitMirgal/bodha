import { describe, expect, it } from "vitest";
import {
	DEFAULT_PG_CONNECTION_TIMEOUT_MS,
	DEFAULT_PG_POOL_MAX,
	DEFAULT_TX_MAX_WAIT_MS,
	DEFAULT_TX_TIMEOUT_MS,
	readPgPoolConnectOptions,
	readPrismaTransactionOptions,
} from "./connect-options";

describe("Prisma / pg connect options", () => {
	it("uses cross-region defaults above Prisma's 2s interactive maxWait", () => {
		expect(DEFAULT_TX_MAX_WAIT_MS).toBeGreaterThan(2000);
		expect(readPrismaTransactionOptions({})).toEqual({
			maxWait: DEFAULT_TX_MAX_WAIT_MS,
			timeout: DEFAULT_TX_TIMEOUT_MS,
		});
		expect(readPgPoolConnectOptions({})).toMatchObject({
			connectionTimeoutMillis: DEFAULT_PG_CONNECTION_TIMEOUT_MS,
			max: DEFAULT_PG_POOL_MAX,
		});
	});

	it("reads explicit millisecond overrides", () => {
		expect(
			readPrismaTransactionOptions({
				MATI_PRISMA_TX_MAX_WAIT_MS: "25000",
				MATI_PRISMA_TX_TIMEOUT_MS: "40000",
			})
		).toEqual({ maxWait: 25_000, timeout: 40_000 });
		expect(
			readPgPoolConnectOptions({
				MATI_PG_CONNECTION_TIMEOUT_MS: "12000",
				MATI_PG_POOL_MAX: "3",
			})
		).toMatchObject({
			connectionTimeoutMillis: 12_000,
			max: 3,
		});
	});

	it("does not read BODHA_* names", () => {
		expect(
			readPrismaTransactionOptions({
				BODHA_PRISMA_TX_MAX_WAIT_MS: "18000",
			})
		).toEqual({
			maxWait: DEFAULT_TX_MAX_WAIT_MS,
			timeout: DEFAULT_TX_TIMEOUT_MS,
		});
	});

	it("rejects non-integer overrides", () => {
		expect(() =>
			readPrismaTransactionOptions({ MATI_PRISMA_TX_MAX_WAIT_MS: "fast" })
		).toThrow(/MATI_PRISMA_TX_MAX_WAIT_MS/);
		expect(() => readPgPoolConnectOptions({ MATI_PG_POOL_MAX: "0" })).toThrow(
			/MATI_PG_POOL_MAX/
		);
	});
});
