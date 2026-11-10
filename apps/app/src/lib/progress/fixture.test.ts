import { describe, expect, it } from "vitest";
import {
	emptyProgressView,
	seededDetailTask,
	seededFactsOnlyTask,
	seededProgressView,
} from "./fixture";

describe("progress fixtures", () => {
	it("keeps the empty view empty", () => {
		const view = emptyProgressView();
		expect(view.tasks).toEqual([]);
		expect(view.summary.measured).toBeNull();
		expect(view.summary.tests).toBeNull();
	});

	it("seeds enough mixed days for charts without inventing zeros", () => {
		const view = seededProgressView();
		const dates = new Set(view.chart.map((point) => point.date));
		expect(dates.size).toBeGreaterThanOrEqual(7);
		expect(view.tasks.some((task) => task.origin === "trainer")).toBe(true);
		expect(view.tasks.some((task) => task.origin === "cursor")).toBe(true);
		expect(view.tasks.some((task) => task.origin === "copilot")).toBe(true);
		expect(view.summary.measured).not.toBeNull();
		expect(view.summary.estimated).not.toBeNull();
		expect(view.summary.missingTaskCount).toBeGreaterThan(0);
		expect(
			view.chart.some(
				(point) =>
					point.measuredInputTokens == null &&
					point.measuredOutputTokens == null &&
					point.promptCount > 0
			)
		).toBe(true);
		const detail = seededDetailTask();
		expect(detail.origin).toBe("cursor");
		expect(detail.reportKind).toBe("coached");
		expect(detail.filePaths).toEqual(["src/auth.test.ts", "src/session.ts"]);
		expect(detail.suggestions[0]?.improvedExample).toContain(
			"src/auth.test.ts"
		);
		expect(detail.needsKey).toBe(false);
		const factsOnly = seededFactsOnlyTask();
		expect(factsOnly.reportKind).toBe("facts_only");
		expect(factsOnly.needsKey).toBe(true);
		expect(factsOnly.suggestions).toEqual([]);
	});
});
