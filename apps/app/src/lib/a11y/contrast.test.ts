import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	BODY_LIGHT,
	CONTRAST_ROWS,
	contrastRatio,
	DARK_BG,
	LIGHT_BG,
	LIME_FILL,
	LIME_TEXT_LIGHT,
	mixHex,
	PRIMARY_FG_LIGHT,
	PRIMARY_FILL_LIGHT,
	PRIMARY_HOVER_LIGHT,
} from "./contrast";

const css = readFileSync(
	new URL("../../app/globals.css", import.meta.url),
	"utf8"
);

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

	it("rejects the inherited body color on the olive primary fill", () => {
		expect(contrastRatio(BODY_LIGHT, PRIMARY_FILL_LIGHT)).toBeLessThan(4.5);
		expect(
			contrastRatio(PRIMARY_FG_LIGHT, PRIMARY_FILL_LIGHT)
		).toBeGreaterThanOrEqual(4.5);
		expect(
			contrastRatio(PRIMARY_FG_LIGHT, PRIMARY_HOVER_LIGHT)
		).toBeGreaterThanOrEqual(4.5);
	});

	it("mixes hover fills toward the surface behind the control", () => {
		expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
		expect(PRIMARY_HOVER_LIGHT).toBe(
			mixHex(PRIMARY_FILL_LIGHT, "#ffffff", 0.1)
		);
	});

	it("keeps primary-foreground light in the CSS tokens and does not inherit on slotted links", () => {
		expect(css).toMatch(/--primary-foreground:\s*#ffffff;/);
		expect(css).toMatch(/a:not\(\[data-slot\]\)/);
		expect(css).not.toMatch(/^a \{/m);
	});
});
