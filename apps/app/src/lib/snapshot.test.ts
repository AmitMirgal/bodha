import { describe, expect, it } from "vitest";
import { challengeFromSnapshot } from "./snapshot";
import type { Challenge } from "./types";

const current: Challenge = {
	id: "cache",
	title: "Current title",
	blurb: "current",
	difficulty: "hard",
	minutes: 20,
	order: 2,
	tasks: [{ id: "t1", kind: "bugs", title: "now", brief: "now" }],
	starter: { "README.md": "current spec", "index.js": "current()" },
	tests: "test('current', () => {})",
};

describe("challengeFromSnapshot", () => {
	it("uses frozen snapshot spec and tests, not the mutable current files", () => {
		const challenge = challengeFromSnapshot(current, {
			exercise_id: "cache",
			spec_markdown: "immutable spec",
			tests_source: "test('snapshot', () => { throw new Error('frozen') })",
			starter: { "README.md": "old", "index.js": "old()" },
			meta: {
				title: "Frozen title",
				blurb: "frozen",
				difficulty: "easy",
				minutes: 15,
				tasks: [{ id: "t1", kind: "bugs", title: "then", brief: "then" }],
			},
		});
		expect(challenge.tests).toContain("frozen");
		expect(challenge.tests).not.toContain("current");
		expect(challenge.starter["README.md"]).toBe("immutable spec");
		expect(challenge.title).toBe("Frozen title");
		expect(challenge.minutes).toBe(15);
	});
});
