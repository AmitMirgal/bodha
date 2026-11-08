import { describe, expect, it } from "vitest";
import { assertStatus, dayBucket } from "./service";

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
});
