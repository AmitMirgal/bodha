import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchCursorAdminUsage, measuredUsageEvent } from "./cursor-admin";

const fixture = JSON.parse(
	readFileSync(
		new URL("./fixtures/cursor-admin-usage.json", import.meta.url),
		"utf8"
	)
) as unknown;

describe("Cursor Admin usage join", () => {
	it("does nothing without a payload (no key / no fetch)", () => {
		expect(matchCursorAdminUsage("conv-editor-1", null)).toBeNull();
	});

	it("joins conversationId onto EditorTaskId and upgrades to measured", () => {
		const matched = matchCursorAdminUsage("conv-editor-1", fixture);
		expect(matched).toEqual({
			conversationId: "conv-editor-1",
			inputTokens: 18,
			outputTokens: 7,
			cachedTokens: 3,
		});
		if (!matched) {
			throw new Error("expected a Cursor Admin match");
		}
		expect(measuredUsageEvent("conv-editor-1", matched)).toMatchObject({
			kind: "usage",
			provenance: "measured",
			source: "cursor_admin_api",
			inputTokens: 18,
			outputTokens: 7,
			cachedTokens: 3,
		});
	});

	it("does not use another conversation's counts", () => {
		expect(matchCursorAdminUsage("missing-conv", fixture)).toBeNull();
	});
});
