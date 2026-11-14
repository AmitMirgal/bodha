import { describe, expect, it } from "vitest";
import { normalizeDisplayName, parseDisplayName } from "./display-name";

describe("parseDisplayName", () => {
	it("accepts names that match the database CHECK", () => {
		expect(parseDisplayName("Ada")).toEqual({ name: "Ada" });
		expect(parseDisplayName("  Ada_Lovelace  ")).toEqual({
			name: "Ada_Lovelace",
		});
		expect(parseDisplayName("A. B-C_9")).toEqual({ name: "A. B-C_9" });
	});

	it("rejects emails, short names, and punctuation the CHECK would reject", () => {
		expect(parseDisplayName("ab")).toEqual({
			error: "Display names must be 3 to 24 characters.",
		});
		expect(parseDisplayName("not-an-email@x.com")).toEqual({
			error:
				"Use letters, numbers, spaces, dots, hyphens, or underscores. No email addresses.",
		});
		expect(parseDisplayName("Ada!")).toEqual({
			error:
				"Use letters, numbers, spaces, dots, hyphens, or underscores. No email addresses.",
		});
		expect(parseDisplayName("")).toEqual({
			error: "Display names must be 3 to 24 characters.",
		});
	});

	it("collapses inner whitespace before length checks", () => {
		expect(normalizeDisplayName("Ada   Lovelace")).toBe("Ada Lovelace");
	});
});
