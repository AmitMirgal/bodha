import { describe, expect, it } from "vitest";
import { BADGE_CATALOG, isBadgeId } from "./catalog";
import { BADGE_IDS } from "./types";

describe("badge catalog", () => {
	it("gives every badge a human title distinct from the id", () => {
		for (const id of BADGE_IDS) {
			expect(isBadgeId(id)).toBe(true);
			expect(BADGE_CATALOG[id].title).not.toBe(id);
			expect(BADGE_CATALOG[id].title).not.toMatch(/_/);
			expect(BADGE_CATALOG[id].id).toBe(id);
		}
	});
});
