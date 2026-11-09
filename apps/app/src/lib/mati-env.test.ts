import { describe, expect, it } from "vitest";
import { matiEnv } from "./mati-env";

describe("matiEnv", () => {
	it("prefers MATI_* over legacy BODHA_*", () => {
		expect(
			matiEnv("ALLOWED_LLM_HOSTS", {
				MATI_ALLOWED_LLM_HOSTS: "api.openai.com",
				BODHA_ALLOWED_LLM_HOSTS: "legacy.example",
			})
		).toBe("api.openai.com");
	});

	it("falls back to BODHA_* when MATI_* is unset", () => {
		expect(
			matiEnv("CREDENTIALS_ENCRYPTION_KEY", {
				BODHA_CREDENTIALS_ENCRYPTION_KEY: "0".repeat(64),
			})
		).toBe("0".repeat(64));
	});

	it("treats blank MATI_* as missing", () => {
		expect(
			matiEnv("PROGRESS_TIMEZONE", {
				MATI_PROGRESS_TIMEZONE: "  ",
				BODHA_PROGRESS_TIMEZONE: "Asia/Kolkata",
			})
		).toBe("Asia/Kolkata");
	});
});
