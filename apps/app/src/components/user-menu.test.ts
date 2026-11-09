import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const menu = readFileSync(new URL("./UserMenu.tsx", import.meta.url), "utf8");
const nav = readFileSync(new URL("./AppNav.tsx", import.meta.url), "utf8");
const progressPage = readFileSync(
	new URL("../app/(app)/progress/page.tsx", import.meta.url),
	"utf8"
);

describe("avatar account menu", () => {
	it("opens from an initials avatar with an accessible label", () => {
		expect(menu).toMatch(/DropdownMenuTrigger/);
		expect(menu).toMatch(/aria-label=\{`Account menu for \$\{email\}`\}/);
		expect(menu).toMatch(/emailInitials/);
		expect(menu).toMatch(/AvatarFallback/);
	});

	it("shows Settings, not Profile settings, next to Sign out", () => {
		expect(menu).toMatch(/>Settings</);
		expect(menu).not.toMatch(/Profile settings/);
		expect(menu).toMatch(/Sign out/);
	});

	it("shows Progress in the header, not Daily progress", () => {
		expect(nav).toMatch(/>Progress</);
		expect(nav).not.toMatch(/Daily progress/);
		expect(nav).not.toMatch(/LLM settings/);
		expect(progressPage).toMatch(/>Progress</);
		expect(progressPage).not.toMatch(/Daily progress/);
	});
});
