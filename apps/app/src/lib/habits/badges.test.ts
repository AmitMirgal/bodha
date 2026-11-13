import { describe, expect, it } from "vitest";
import { computeBadges } from "./badges";
import { hasClearSpec } from "./spec-heuristic";
import type { HabitTask } from "./types";

function closed(input: {
	claimed?: boolean;
	finishedAt: string;
	id: string;
	openedAt?: string | null;
	prompts: string[];
}): HabitTask {
	return {
		claimedByUser: input.claimed ?? true,
		finishedAt: input.finishedAt,
		id: input.id,
		prompts: input.prompts.map((text, index) => ({
			id: `${input.id}-p${index}`,
			occurredAt: input.finishedAt,
			text,
		})),
		reportOpenedAt: input.openedAt ?? null,
		startedAt: input.finishedAt,
		status: "closed",
	};
}

describe("hasClearSpec", () => {
	it("requires a goal verb and a constraint word", () => {
		expect(hasClearSpec("fix it")).toBe(false);
		expect(
			hasClearSpec("Implement login so that empty passwords always fail.")
		).toBe(true);
		expect(
			hasClearSpec("Please look at the flaky test and tell me what you think.")
		).toBe(false);
	});
});

describe("computeBadges", () => {
	const now = "2026-11-13T18:00:00.000Z";

	it("awards first_close on the earliest closed claimed task", () => {
		const badges = computeBadges(
			[
				closed({
					finishedAt: "2026-11-12T10:00:00.000Z",
					id: "later",
					prompts: ["later"],
				}),
				closed({
					finishedAt: "2026-11-11T10:00:00.000Z",
					id: "first",
					prompts: ["first"],
				}),
				closed({
					claimed: false,
					finishedAt: "2026-11-10T10:00:00.000Z",
					id: "unclaimed",
					prompts: ["no"],
				}),
			],
			"UTC",
			now
		);
		const first = badges.find((badge) => badge.id === "first_close");
		expect(first?.earned).toBe(true);
		expect(first?.sourceTaskId).toBe("first");
		expect(first?.href).toBe("/capture/tasks/first");
		expect(first?.heuristic).toBe(false);
	});

	it("awards first_report only after a closed task report is opened", () => {
		const unread = computeBadges(
			[
				closed({
					finishedAt: "2026-11-11T10:00:00.000Z",
					id: "closed",
					openedAt: null,
					prompts: ["hi"],
				}),
			],
			"UTC",
			now
		);
		expect(unread.find((badge) => badge.id === "first_report")?.earned).toBe(
			false
		);
		const read = computeBadges(
			[
				closed({
					finishedAt: "2026-11-11T10:00:00.000Z",
					id: "closed",
					openedAt: "2026-11-11T12:00:00.000Z",
					prompts: ["hi"],
				}),
			],
			"UTC",
			now
		);
		expect(
			read.find((badge) => badge.id === "first_report")?.sourceTaskId
		).toBe("closed");
	});

	it("labels clear_spec as a heuristic and links the earning prompt's task", () => {
		const badges = computeBadges(
			[
				closed({
					finishedAt: "2026-11-11T10:00:00.000Z",
					id: "vague",
					prompts: ["fix the test"],
				}),
				closed({
					finishedAt: "2026-11-12T10:00:00.000Z",
					id: "spec",
					prompts: [
						"Implement auth so that empty passwords must fail the login test.",
					],
				}),
			],
			"UTC",
			now
		);
		const spec = badges.find((badge) => badge.id === "clear_spec");
		expect(spec?.earned).toBe(true);
		expect(spec?.heuristic).toBe(true);
		expect(spec?.sourceTaskId).toBe("spec");
	});

	it("awards one_shot for a single prompt and skips re-prompted tasks", () => {
		const badges = computeBadges(
			[
				closed({
					finishedAt: "2026-11-11T10:00:00.000Z",
					id: "retry",
					prompts: ["fix it", "try again"],
				}),
				closed({
					finishedAt: "2026-11-12T10:00:00.000Z",
					id: "once",
					prompts: ["Implement the cache without extra retries."],
				}),
			],
			"UTC",
			now
		);
		expect(badges.find((badge) => badge.id === "one_shot")?.sourceTaskId).toBe(
			"once"
		);
	});

	it("awards report_3 on the third distinct opened report", () => {
		const badges = computeBadges(
			[
				closed({
					finishedAt: "2026-11-10T10:00:00.000Z",
					id: "one",
					openedAt: "2026-11-10T11:00:00.000Z",
					prompts: ["a"],
				}),
				closed({
					finishedAt: "2026-11-11T10:00:00.000Z",
					id: "two",
					openedAt: "2026-11-11T11:00:00.000Z",
					prompts: ["b"],
				}),
				closed({
					finishedAt: "2026-11-12T10:00:00.000Z",
					id: "three",
					openedAt: "2026-11-12T11:00:00.000Z",
					prompts: ["c"],
				}),
			],
			"UTC",
			now
		);
		expect(badges.find((badge) => badge.id === "report_3")?.sourceTaskId).toBe(
			"three"
		);
	});

	it("awards streak_7 after seven consecutive qualifying days", () => {
		const tasks = Array.from({ length: 7 }, (_, index) => {
			const day = String(index + 1).padStart(2, "0");
			return closed({
				finishedAt: `2026-11-${day}T12:00:00.000Z`,
				id: `d${day}`,
				openedAt: `2026-11-${day}T12:00:00.000Z`,
				prompts: ["one"],
			});
		});
		const earned = computeBadges(tasks, "UTC", "2026-11-07T18:00:00.000Z");
		expect(earned.find((badge) => badge.id === "streak_7")?.earned).toBe(true);
		expect(earned.find((badge) => badge.id === "streak_7")?.sourceTaskId).toBe(
			"d07"
		);
		const short = computeBadges(
			tasks.slice(0, 6),
			"UTC",
			"2026-11-06T18:00:00.000Z"
		);
		expect(short.find((badge) => badge.id === "streak_7")?.earned).toBe(false);
	});
});
