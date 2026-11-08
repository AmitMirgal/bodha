import { describe, expect, it } from "vitest";
import { recentChronologicalTurns } from "./history";

describe("recentChronologicalTurns", () => {
	it("keeps the latest turns once history exceeds the window", () => {
		const rows = Array.from({ length: 25 }, (_, index) => ({
			n: index + 1,
		})).reverse();
		const selected = recentChronologicalTurns(rows, 20);
		expect(selected).toHaveLength(20);
		expect(selected[0]?.n).toBe(6);
		expect(selected.at(-1)?.n).toBe(25);
		expect(selected.map((row) => row.n)).not.toContain(1);
	});
});
