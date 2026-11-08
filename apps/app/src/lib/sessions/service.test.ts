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
			"2026-11-09"
		);
	});

	it("surfaces a revision conflict when expectedUpdatedAt does not match", async () => {
		const db = {
			session: {
				updateMany: async () => await Promise.resolve({ count: 0 }),
				findFirst: async () =>
					await Promise.resolve({
						id: "s",
						status: "running",
						updatedAt: new Date("2026-11-08T00:00:00.000Z"),
					}),
			},
		};
		await expect(
			saveFiles(db as never, "u", "s", { "index.js": "x" }, "old-rev")
		).rejects.toBeInstanceOf(RevisionConflictError);
	});
});
