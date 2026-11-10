import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const logo = readFileSync(new URL("./Logo.tsx", import.meta.url), "utf8");
const nav = readFileSync(new URL("./AppNav.tsx", import.meta.url), "utf8");
const header = readFileSync(
	new URL("./MarketingHeader.tsx", import.meta.url),
	"utf8"
);
const login = readFileSync(new URL("./LoginForm.tsx", import.meta.url), "utf8");
const round = readFileSync(new URL("./Round.tsx", import.meta.url), "utf8");

describe("shared Mati logo", () => {
	it("renders the // mark and Mati wordmark once", () => {
		expect(logo).toMatch(/\{\s*"\/\/"\s*\}/);
		expect(logo).toMatch(/Mati/);
		expect(logo).toMatch(/href = "\/"/);
		expect(logo).toMatch(/from "next\/link"/);
	});

	it("is used by marketing, app nav, login, and the trainer bar", () => {
		expect(nav).toMatch(/from "\.\/Logo"/);
		expect(header).toMatch(/from "\.\/Logo"/);
		expect(login).toMatch(/from "\.\/Logo"/);
		expect(round).toMatch(/from "\.\/Logo"/);
		expect(nav).toMatch(/<Logo/);
		expect(header).toMatch(/<Logo/);
		expect(login).toMatch(/<Logo/);
		expect(round).toMatch(/<Logo/);
	});
});
