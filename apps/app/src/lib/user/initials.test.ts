import { describe, expect, it } from "vitest";
import { emailInitials } from "./initials";

describe("emailInitials", () => {
	it("uses the first two letters of a simple local part", () => {
		expect(emailInitials("amit@cluwis.com")).toBe("AM");
	});

	it("uses dotted name parts", () => {
		expect(emailInitials("amit.mirgal@example.test")).toBe("AM");
	});

	it("falls back to a question mark for empty input", () => {
		expect(emailInitials("")).toBe("?");
		expect(emailInitials("@example.test")).toBe("?");
	});
});
