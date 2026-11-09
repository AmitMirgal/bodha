import { describe, expect, it } from "vitest";
import { redactSecrets } from "./redact";

describe("on-device redaction", () => {
	it("replaces an AWS key with [redacted:aws_access_key]", () => {
		expect(redactSecrets("use AKIAIOSFODNN7EXAMPLE now")).toBe(
			"use [redacted:aws_access_key] now"
		);
	});
});
