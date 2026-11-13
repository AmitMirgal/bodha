import { describe, expect, it } from "vitest";
import { computeHabits } from "./compute";
import type { HabitTask } from "./types";

function closed(input: {
	finishedAt: string;
	id: string;
	openedAt?: string | null;
	prompts: string[];
}): HabitTask {
	return {
		claimedByUser: true,
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

describe("weekly quests", () => {
	it("asks for the first missing badge and for opening a report today", () => {
		const result = computeHabits({
			now: "2026-11-13T18:00:00.000Z",
			tasks: [],
			timezone: "UTC",
		});
		expect(result.quests[0]?.id).toBe("quest_first_close");
		expect(result.quests[0]?.complete).toBe(false);
		expect(result.quests[1]?.id).toBe("open_today");
		expect(result.quests[1]?.complete).toBe(false);
	});

	it("marks the gap quest complete when that badge was earned this UTC week", () => {
		const result = computeHabits({
			now: "2026-11-13T18:00:00.000Z",
			tasks: [
				closed({
					finishedAt: "2026-11-11T12:00:00.000Z",
					id: "one",
					openedAt: null,
					prompts: ["ship it"],
				}),
			],
			timezone: "UTC",
		});
		expect(result.quests[0]?.id).toBe("quest_first_close");
		expect(result.quests[0]?.complete).toBe(true);
	});

	it("switches cadence to three report days after today already qualifies", () => {
		const result = computeHabits({
			now: "2026-11-13T18:00:00.000Z",
			tasks: [
				closed({
					finishedAt: "2026-11-13T12:00:00.000Z",
					id: "today",
					openedAt: "2026-11-13T12:00:00.000Z",
					prompts: ["ship it"],
				}),
			],
			timezone: "UTC",
		});
		expect(result.quests[1]?.id).toBe("week_three_days");
		expect(result.quests[1]?.complete).toBe(false);
	});
});
