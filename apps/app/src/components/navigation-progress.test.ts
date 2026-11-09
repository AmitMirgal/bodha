import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const navLink = readFileSync(new URL("./NavLink.tsx", import.meta.url), "utf8");
const progress = readFileSync(
	new URL("./NavigationProgress.tsx", import.meta.url),
	"utf8"
);
const layout = readFileSync(
	new URL("../app/layout.tsx", import.meta.url),
	"utf8"
);
const shell = readFileSync(
	new URL("../app/(app)/layout.tsx", import.meta.url),
	"utf8"
);
const loading = readFileSync(
	new URL("../app/(app)/loading.tsx", import.meta.url),
	"utf8"
);

describe("navigation pending feedback", () => {
	it("uses next/link prefetch and useLinkStatus", () => {
		expect(navLink).toMatch(/useLinkStatus/);
		expect(navLink).toMatch(/prefetch/);
	});

	it("shows a top progress bar on internal clicks", () => {
		expect(progress).toMatch(/role="progressbar"/);
		expect(progress).toMatch(/markNavigating/);
		expect(layout).toMatch(/NavigationProgress/);
		expect(layout).toMatch(/defaultTheme="system"/);
		expect(layout).toMatch(/suppressHydrationWarning/);
		expect(layout).not.toMatch(/className="dark"/);
	});

	it("keeps the shell visible while the page segment loads", () => {
		expect(shell).toMatch(/Suspense/);
		expect(shell).toMatch(/UserNav/);
		expect(loading).toMatch(/PageSkeleton/);
	});
});
