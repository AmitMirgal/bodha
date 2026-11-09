import { describe, expect, it } from "vitest";
import { estimateTokensFromText, redactSecrets } from "./redact";

describe("redactSecrets", () => {
	it("masks the documented secret classes without dropping the event text", () => {
		const raw = [
			"key AKIAIOSFODNN7EXAMPLE please",
			"token ghp_abcdefghijklmnopqrstuvwxyz0123456789 extra",
			"Bearer abcdef012345",
			"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnopqrstuv",
			"sk_live_abcdefghijklmnopqrstuv",
			"xoxb-1234567890-abcdefghij",
			"-----BEGIN PRIVATE KEY-----\nMIIHide\n-----END PRIVATE KEY-----",
			"OPENAI_API_KEY=sk-secret-value",
			"Fix the flaky test",
		].join("\n");
		const redacted = redactSecrets(raw);
		expect(redacted).toContain("[redacted:aws_access_key]");
		expect(redacted).toContain("[redacted:github_token]");
		expect(redacted).toContain("[redacted:bearer]");
		expect(redacted).toContain("[redacted:jwt]");
		expect(redacted).toContain("[redacted:stripe_live_key]");
		expect(redacted).toContain("[redacted:slack_token]");
		expect(redacted).toContain("[redacted:private_key]");
		expect(redacted).toContain("OPENAI_API_KEY=[redacted:env]");
		expect(redacted).toContain("Fix the flaky test");
		expect(redacted).not.toContain("AKIAIOSFODNN7EXAMPLE");
		expect(redacted).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz0123456789");
		expect(redacted).not.toContain("sk-secret-value");
	});

	it("estimates tokens as unicode length / 4", () => {
		expect(estimateTokensFromText("abcd")).toBe(1);
		expect(estimateTokensFromText("abcde")).toBe(2);
		expect(estimateTokensFromText("🙂🙂")).toBe(1);
	});
});
