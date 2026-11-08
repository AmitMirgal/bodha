import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
	it("keeps in-app relative paths", () => {
		expect(safeNextPath("/session/abc")).toBe("/session/abc");
	});

	it("rejects open redirects", () => {
		expect(safeNextPath("https://evil.example/phish")).toBe("/");
		expect(safeNextPath("//evil.example")).toBe("/");
		expect(safeNextPath("/\\evil.example")).toBe("/");
		expect(safeNextPath("session/abc")).toBe("/");
	});
});
