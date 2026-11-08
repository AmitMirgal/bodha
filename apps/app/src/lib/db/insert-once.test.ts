import { describe, expect, it } from "vitest";
import { insertOnce, isUniqueViolation } from "./insert-once";

function client(script: {
	insert: {
		data: Record<string, unknown> | null;
		error: { code?: string } | null;
	};
	existing?: Record<string, unknown> | null;
}) {
	const ops: string[] = [];
	return {
		ops,
		from(table: string) {
			return {
				insert() {
					ops.push(`insert:${table}`);
					return {
						select() {
							return {
								single: async () => script.insert,
							};
						},
					};
				},
				upsert() {
					ops.push(`upsert:${table}`);
					throw new Error("upsert must not be used on immutable tables");
				},
				select() {
					ops.push(`select:${table}`);
					const query = {
						eq() {
							return query;
						},
						maybeSingle: async () => ({
							data: script.existing ?? null,
							error: null,
						}),
					};
					return query;
				},
			};
		},
	};
}

describe("insertOnce", () => {
	it("inserts when no conflict", async () => {
		const supabase = client({
			insert: { data: { id: "new", seq: 1 }, error: null },
		});
		const result = await insertOnce(
			supabase as never,
			"evidence_events",
			{ session_id: "s" },
			{ session_id: "s" },
			"id, seq",
		);
		expect(result.created).toBe(true);
		expect(result.data.id).toBe("new");
		expect(supabase.ops).toEqual(["insert:evidence_events"]);
	});

	it("selects the first write on unique violation instead of updating", async () => {
		const supabase = client({
			insert: { data: null, error: { code: "23505" } },
			existing: { id: "old", seq: 1, payload: { first: true } },
		});
		const result = await insertOnce(
			supabase as never,
			"evidence_events",
			{ payload: { second: true } },
			{ session_id: "s", idempotency_key: "k" },
			"id, seq, payload",
		);
		expect(result.created).toBe(false);
		expect(result.data.payload).toEqual({ first: true });
		expect(supabase.ops).toEqual([
			"insert:evidence_events",
			"select:evidence_events",
		]);
	});

	it("recognizes Postgres unique_violation", () => {
		expect(isUniqueViolation({ code: "23505" })).toBe(true);
		expect(isUniqueViolation({ code: "42501" })).toBe(false);
	});
});
