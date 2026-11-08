import { describe, expect, it } from "vitest";
import { RevisionConflictError } from "../errors";
import { assertStatus, dayBucket, saveFiles } from "./service";

describe("session helpers", () => {
	it("rejects unknown statuses", () => {
		expect(() => assertStatus("graded")).toThrow(/Unknown session status/);
	});

	it("buckets days in the configured timezone", () => {
		expect(dayBucket("2026-11-08T23:30:00.000Z", "UTC")).toBe("2026-11-08");
		expect(dayBucket("2026-11-08T23:30:00.000Z", "Pacific/Auckland")).toBe(
			"2026-11-09",
		);
	});

	it("surfaces a revision conflict when expectedUpdatedAt does not match", async () => {
		let fromCount = 0;
		const supabase = {
			from() {
				fromCount += 1;
				if (fromCount === 1) {
					return {
						update() {
							return this;
						},
						eq() {
							return this;
						},
						select() {
							return this;
						},
						maybeSingle: async () => ({ data: null, error: null }),
					};
				}
				return {
					select() {
						return this;
					},
					eq() {
						return this;
					},
					maybeSingle: async () => ({
						data: { id: "s", status: "running", updated_at: "newer" },
						error: null,
					}),
				};
			},
		};
		await expect(
			saveFiles(supabase as never, "u", "s", { "index.js": "x" }, "old-rev"),
		).rejects.toBeInstanceOf(RevisionConflictError);
	});
});
