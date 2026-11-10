import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
	it("keeps in-app relative paths", () => {
		expect(safeNextPath("/session/abc")).toBe("/session/abc");
		expect(
			safeNextPath(
				"/capture/d/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?v=viewer&claim=abc"
			)
		).toBe(
			"/capture/d/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?v=viewer&claim=abc"
		);
	});

	it("rejects open redirects", () => {
		expect(safeNextPath("https://evil.example/phish")).toBe("/exercises");
		expect(safeNextPath("//evil.example")).toBe("/exercises");
		expect(safeNextPath("/\\evil.example")).toBe("/exercises");
		expect(safeNextPath("session/abc")).toBe("/exercises");
	});

	it("defaults successful login to exercises when next is missing", () => {
		expect(safeNextPath(null)).toBe("/exercises");
		expect(safeNextPath("")).toBe("/exercises");
	});
});
