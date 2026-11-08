import { describe, expect, it } from "vitest";
import { insertOnce, isPrismaUnique, isUniqueViolation } from "./insert-once";

const db = {
	$executeRawUnsafe: async () => await Promise.resolve(undefined),
};

describe("insertOnce", () => {
	it("inserts when no conflict", async () => {
		const result = await insertOnce(
			db,
			async () => await Promise.resolve({ id: "new", seq: 1 }),
			async () => {
				await Promise.resolve();
				throw new Error("findExisting must not run");
			}
		);
		expect(result.created).toBe(true);
		expect(result.data.id).toBe("new");
	});

	it("selects the first write on unique violation instead of updating", async () => {
		const ops: string[] = [];
		const result = await insertOnce(
			{
				$executeRawUnsafe: async (sql: string) => {
					ops.push(sql);
					await Promise.resolve();
				},
			},
			async () => {
				await Promise.resolve();
				throw Object.assign(new Error("unique"), { code: "P2002" });
			},
			async () =>
				await Promise.resolve({
					id: "old",
					seq: 1,
					payload: { first: true },
				})
		);
		expect(result.created).toBe(false);
		expect(result.data.payload).toEqual({ first: true });
		expect(ops.some((sql) => sql.includes("ROLLBACK TO SAVEPOINT"))).toBe(true);
	});

	it("recognizes Postgres unique_violation and Prisma P2002", () => {
		expect(isUniqueViolation({ code: "23505" })).toBe(true);
		expect(isPrismaUnique({ code: "P2002" })).toBe(true);
		expect(isUniqueViolation({ code: "42501" })).toBe(false);
	});
});
