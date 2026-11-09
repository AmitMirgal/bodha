import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
const marketingPage = readFileSync(
	new URL("../app/page.tsx", import.meta.url),
	"utf8"
);
const exercisesPage = readFileSync(
	new URL("../app/(app)/exercises/page.tsx", import.meta.url),
	"utf8"
);
const progressPage = readFileSync(
	new URL("../app/(app)/progress/page.tsx", import.meta.url),
	"utf8"
);
const settingsPage = readFileSync(
	new URL("../app/(app)/settings/page.tsx", import.meta.url),
	"utf8"
);

describe("marketing page is public", () => {
	it("renders the restored landing at / without auth", () => {
		expect(marketingPage).toMatch(/MarketingHome/);
		expect(marketingPage).not.toMatch(/requireUser/);
		expect(marketingPage).not.toMatch(/redirect/);
		expect(home).toMatch(/Mati/);
		expect(home).toMatch(/Get started/);
		expect(home).toMatch(/href="\/login\?next=\/exercises"/);
		expect(home).toMatch(/href="\/login"/);
	});

	it("keeps trainer, Progress, and Settings behind auth redirects", () => {
		expect(exercisesPage).toMatch(/requireUser/);
		expect(exercisesPage).toMatch(/redirect\("\/login\?next=\/exercises"\)/);
		expect(progressPage).toMatch(/requireUser/);
		expect(progressPage).toMatch(/redirect\("\/login\?next=\/progress"\)/);
		expect(settingsPage).toMatch(/requireUser/);
		expect(settingsPage).toMatch(/redirect\("\/login\?next=\/settings"\)/);
	});
});
