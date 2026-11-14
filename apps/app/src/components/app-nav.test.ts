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
	it("uses shadcn NavigationMenu for Exercises, Progress, and Leaderboard", () => {
		expect(nav).toMatch(/NavigationMenu/);
		expect(nav).toMatch(/Exercises/);
		expect(nav).toMatch(/Progress/);
		expect(nav).toMatch(/Leaderboard/);
		expect(nav).toMatch(/aria-current=\{active \? "page"/);
		expect(nav).toMatch(/Open menu/);
		expect(nav).toMatch(/aria-expanded=\{menuOpen\}/);
	});

	it("puts Settings and Sign out in the mobile sheet and keeps the desktop avatar menu", () => {
		expect(nav).toMatch(/UserMenu/);
		expect(nav).toMatch(/hidden md:block/);
		expect(nav).toMatch(/href="\/settings"/);
		expect(nav).toMatch(/Sign out/);
	});

	it("defaults post-login redirects to /exercises", () => {
		expect(safeNext).toMatch(/DEFAULT_POST_LOGIN_PATH/);
	});
});

describe("marketing header signed-in state", () => {
	it("shows Exercises, Progress, Leaderboard, and Sign out when signed in", () => {
		expect(header).toMatch(/Exercises/);
		expect(header).toMatch(/Progress/);
		expect(header).toMatch(/Leaderboard/);
		expect(header).toMatch(/Sign out/);
		expect(header).toMatch(/Sign in/);
		expect(header).toMatch(/Open menu/);
		expect(header).toMatch(/aria-expanded=\{menuOpen\}/);
		expect(header).toMatch(/home-nav-menu/);
	});

	it("changes the hero CTA to continue to exercises when signed in", () => {
		expect(home).toMatch(/Continue to exercises/);
		expect(home).toMatch(/Get started/);
		expect(home).toMatch(/href="\/exercises"/);
	});
});
