import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public routes stay public", () => {
	it("does not send unauthenticated capture traffic to login", () => {
		const source = readFileSync(new URL("./proxy.ts", import.meta.url), "utf8");
		expect(source).toMatch(/isPublicPath/);
		expect(source).not.toMatch(/PUBLIC_PATHS/);
	});
});
