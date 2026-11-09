import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const menu = readFileSync(new URL("./UserMenu.tsx", import.meta.url), "utf8");
const nav = readFileSync(new URL("./AppNav.tsx", import.meta.url), "utf8");

describe("avatar account menu", () => {
	it("opens from an initials avatar with an accessible label", () => {
		expect(menu).toMatch(/DropdownMenuTrigger/);
		expect(menu).toMatch(/aria-label=\{`Account menu for \$\{email\}`\}/);
		expect(menu).toMatch(/emailInitials/);
		expect(menu).toMatch(/AvatarFallback/);
	});

	it("shows the signed-in email, Profile settings, and Sign out", () => {
		expect(menu).toMatch(/DropdownMenuLabel/);
		expect(menu).toMatch(/Profile settings/);
		expect(menu).toMatch(/Sign out/);
		expect(menu).toMatch(/href="\/settings"/);
		expect(menu).toMatch(/signOutRequest/);
		expect(menu).not.toMatch(/onClick=\{signOut\}/);
	});

	it("keeps LLM settings out of the header", () => {
		expect(nav).not.toMatch(/LLM settings/);
		expect(nav).toMatch(/UserMenu/);
		expect(nav).not.toMatch(/Sign out/);
	});
});
