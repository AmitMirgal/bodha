import { describe, expect, it } from "vitest";
import {
	knownMeasuredTotal,
	measuredDelta,
	tokenAmount,
	tokenMeterSegments,
} from "./display";
import type { ProgressChartPoint, ProgressUsage } from "./types";

const missing: ProgressUsage = {
	cachedTokens: null,
	coverage: "unknown",
	inputTokens: null,
	label: "missing",
	outputTokens: null,
};

describe("token honesty helpers", () => {
	it("prints a dash for a null count", () => {
		expect(tokenAmount(null)).toBe("—");
		expect(tokenAmount(0)).toBe("0");
	});

	it("omits missing usage from the meter instead of drawing zero", () => {
		expect(tokenMeterSegments(missing)).toBeNull();
		const partial = tokenMeterSegments({
			cachedTokens: null,
			coverage: "partial",
			inputTokens: 12,
			label: "measured",
			outputTokens: null,
		});
		expect(partial).toEqual([
			{ color: "var(--chart-1)", key: "input", pct: 100, value: 12 },
		]);
	});

	it("does not invent a measured day total when every field is missing", () => {
		const point: ProgressChartPoint = {
			date: "2026-11-01",
			estimatedInputTokens: null,
			estimatedOutputTokens: null,
			measuredCachedTokens: null,
			measuredInputTokens: null,
			measuredOutputTokens: null,
			promptCount: 1,
			taskCount: 1,
		};
		expect(knownMeasuredTotal(point)).toBeNull();
		expect(
			measuredDelta([
				point,
				{ ...point, date: "2026-11-02", measuredInputTokens: 10 },
			])
		).toBeNull();
	});
});
