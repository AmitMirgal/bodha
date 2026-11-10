import { describe, expect, it } from "vitest";
import {
	CONTRAST_ROWS,
	contrastRatio,
	DARK_BG,
	LIGHT_BG,
	LIME_FILL,
	LIME_TEXT_LIGHT,
} from "./contrast";

describe("WCAG 2.2 contrast tokens", () => {
	it("keeps neon lime off light text", () => {
		expect(contrastRatio(LIME_FILL, LIGHT_BG)).toBeLessThan(2);
		expect(contrastRatio(LIME_TEXT_LIGHT, LIGHT_BG)).toBeGreaterThanOrEqual(
			4.5
		);
		expect(contrastRatio(LIME_FILL, DARK_BG)).toBeGreaterThanOrEqual(4.5);
	});

	it("meets AA for documented token pairs in both themes", () => {
		const table = CONTRAST_ROWS.map((row) => {
			const light = contrastRatio(row.lightFg, row.lightBg);
			const dark = contrastRatio(row.darkFg, row.darkBg);
			const min = row.ui ? 3 : 4.5;
			return { ...row, dark, light, min };
		});
		for (const row of table) {
			expect(row.light, `${row.token} light`).toBeGreaterThanOrEqual(row.min);
			expect(row.dark, `${row.token} dark`).toBeGreaterThanOrEqual(row.min);
		}
	});
});
