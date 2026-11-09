import { describe, expect, it } from "vitest";
import {
	DatabaseTransactionError,
	mapPrismaTransactionError,
	RlsContextError,
	TRANSACTION_START_HINT,
} from "./rls";

describe("mapPrismaTransactionError", () => {
	it("replaces P2028 with an actionable message and does not echo URLs", () => {
		const original = Object.assign(
			new Error(
				"Transaction API error: Unable to start a transaction in the given time. postgresql://postgres.example:s3cret@db.example.test:6543/postgres"
			),
			{ code: "P2028", name: "PrismaClientKnownRequestError" }
		);
		expect(() => mapPrismaTransactionError(original)).toThrow(
			DatabaseTransactionError
		);
		try {
			mapPrismaTransactionError(original);
		} catch (error) {
			expect(error).toBeInstanceOf(DatabaseTransactionError);
			const message = error instanceof Error ? error.message : "";
			expect(message).toBe(TRANSACTION_START_HINT);
			expect(message).toMatch(/p@ss → p%40ss/);
			expect(message).not.toMatch(/s3cret/);
			expect(message).not.toMatch(/db\.example\.test/);
			expect(message).not.toMatch(/postgresql:\/\//);
		}
	});

	it("maps driver connection timeouts the same way", () => {
		expect(() =>
			mapPrismaTransactionError(new Error("timeout expired"))
		).toThrow(DatabaseTransactionError);
	});

	it("rethrows RLS failures unchanged", () => {
		const rls = new RlsContextError("Refusing to run product queries.");
		expect(() => mapPrismaTransactionError(rls)).toThrow(rls);
	});

	it("rethrows unrelated errors unchanged", () => {
		const other = new Error("unique constraint");
		expect(() => mapPrismaTransactionError(other)).toThrow(other);
	});
});
