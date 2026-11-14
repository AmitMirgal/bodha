import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
	new URL("../app/globals.css", import.meta.url),
	"utf8"
);
const llm = readFileSync(
	new URL("./LlmSettingsForm.tsx", import.meta.url),
	"utf8"
);
const theme = readFileSync(
	new URL("./ThemeSwitcher.tsx", import.meta.url),
	"utf8"
);
const home = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
const ai = readFileSync(new URL("./AiPanel.tsx", import.meta.url), "utf8");
const round = readFileSync(new URL("./Round.tsx", import.meta.url), "utf8");
const header = readFileSync(
	new URL("./MarketingHeader.tsx", import.meta.url),
	"utf8"
);

describe("shadcn controls and select scroll lock", () => {
	it("does not put overflow-x clip on html (Radix RemoveScroll jump)", () => {
		expect(css).not.toMatch(/html,\s*body\s*\{\s*overflow-x:\s*clip/);
		expect(css).toMatch(/body,\s*#root\s*\{\s*overflow-x:\s*clip/);
		expect(css).toMatch(/RemoveScroll/);
	});

	it("uses shadcn Select for the Settings provider field", () => {
		expect(llm).toMatch(/from "@repo\/design-system\/components\/ui\/select"/);
		expect(llm).toMatch(/SelectTrigger className="w-full"/);
		expect(llm).not.toMatch(/<select/);
	});

	it("uses shadcn RadioGroup for appearance", () => {
		expect(theme).toMatch(/RadioGroupItem/);
		expect(theme).not.toMatch(/type="radio"/);
	});

	it("uses shadcn Button and Textarea instead of native trainer/marketing controls", () => {
		expect(home).toMatch(/from "@repo\/design-system\/components\/ui\/button"/);
		expect(home).toMatch(/Button asChild className="btn lime big"/);
		expect(ai).toMatch(/from "@repo\/design-system\/components\/ui\/textarea"/);
		expect(ai).not.toMatch(/<textarea/);
		expect(round).toMatch(
			/from "@repo\/design-system\/components\/ui\/button"/
		);
		expect(round).not.toMatch(/<button/);
		expect(header).not.toMatch(/<button/);
	});
});
