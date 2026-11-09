import { describe, expect, it } from "vitest";
import { isPublicPath } from "./public-path";

describe("isPublicPath", () => {
	it("keeps the marketing page public without making every path public", () => {
		expect(isPublicPath("/")).toBe(true);
		expect(isPublicPath("/login")).toBe(true);
		expect(isPublicPath("/progress")).toBe(false);
		expect(isPublicPath("/settings")).toBe(false);
		expect(isPublicPath("/exercises")).toBe(false);
		expect(isPublicPath("/session/abc")).toBe(false);
	});
});
