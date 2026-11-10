import { describe, expect, it } from "vitest";
import { groupTasksByDay } from "./aggregate";
import {
	durationLabel,
	knownMeasuredTotal,
	measuredDelta,
	reportKindLabel,
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

	it("labels report kinds and duration without inventing a time", () => {
		expect(reportKindLabel("coached")).toBe("Report ready");
		expect(reportKindLabel("facts_only")).toBe("Facts only");
		expect(reportKindLabel("none")).toBe("No report");
		expect(
			durationLabel("2026-11-09T11:00:00.000Z", "2026-11-09T11:18:00.000Z")
		).toBe("18 min");
		expect(durationLabel("2026-11-09T11:00:00.000Z", null)).toBeNull();
	});

	it("groups tasks by day newest first", () => {
		const usage = missing;
		const base = {
			coachingSummary: null,
			exerciseId: "shelf",
			filePaths: [] as string[],
			finishedAt: null,
			needsKey: false,
			origin: "trainer" as const,
			outcome: null,
			prompts: ["a"],
			promptTurns: [],
			reportError: null,
			reportHref: "/progress",
			reportKind: "none" as const,
			reportStatus: "none" as const,
			responses: [],
			source: "trainer" as const,
			startedAt: null,
			status: "complete",
			suggestions: [],
			tests: null,
			usage,
		};
		const days = groupTasksByDay(
			[
				{
					...base,
					occurredAt: "2026-11-08T12:00:00.000Z",
					sessionId: "older",
				},
				{
					...base,
					occurredAt: "2026-11-09T12:00:00.000Z",
					sessionId: "newer",
				},
			],
			"UTC"
		);
		expect(days.map((day) => day.date)).toEqual(["2026-11-09", "2026-11-08"]);
		expect(days[0]?.tasks[0]?.sessionId).toBe("newer");
	});
});
