import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const nav = readFileSync(new URL("./AppNav.tsx", import.meta.url), "utf8");
const header = readFileSync(
	new URL("./MarketingHeader.tsx", import.meta.url),
	"utf8"
);
const home = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
const safeNext = readFileSync(
	new URL("../lib/http/safe-next.ts", import.meta.url),
	"utf8"
);

describe("signed-in app navigation", () => {
	it("uses shadcn NavigationMenu for Exercises and Progress", () => {
		expect(nav).toMatch(/NavigationMenu/);
		expect(nav).toMatch(/Exercises/);
		expect(nav).toMatch(/Progress/);
		expect(nav).toMatch(/aria-current=\{active \? "page"/);
		expect(nav).toMatch(/Open menu/);
	});

	it("keeps the avatar menu for Settings and Sign out", () => {
		expect(nav).toMatch(/UserMenu/);
	});

	it("defaults post-login redirects to /exercises", () => {
		expect(safeNext).toMatch(/DEFAULT_POST_LOGIN_PATH/);
	});
});

describe("marketing header signed-in state", () => {
	it("shows Exercises, Progress, and Sign out when signed in", () => {
		expect(header).toMatch(/Exercises/);
		expect(header).toMatch(/Progress/);
		expect(header).toMatch(/Sign out/);
		expect(header).toMatch(/Sign in/);
	});

	it("changes the hero CTA to continue to exercises when signed in", () => {
		expect(home).toMatch(/Continue to exercises/);
		expect(home).toMatch(/Get started/);
		expect(home).toMatch(/href="\/exercises"/);
	});
});
