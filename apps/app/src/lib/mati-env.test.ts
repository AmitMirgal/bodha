import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matiEnv } from "./mati-env";

describe("matiEnv", () => {
	it("reads MATI_* only", () => {
		expect(
			matiEnv("CREDENTIALS_ENCRYPTION_KEY", {
				MATI_CREDENTIALS_ENCRYPTION_KEY: "0".repeat(64),
			})
		).toBe("0".repeat(64));
		expect(
			matiEnv("PROGRESS_TIMEZONE", {
				MATI_PROGRESS_TIMEZONE: "Asia/Kolkata",
			})
		).toBe("Asia/Kolkata");
	});

	it("does not read BODHA_* names", () => {
		expect(
			matiEnv("CREDENTIALS_ENCRYPTION_KEY", {
				BODHA_CREDENTIALS_ENCRYPTION_KEY: "0".repeat(64),
			})
		).toBeUndefined();
		expect(
			matiEnv("ALLOWED_LLM_HOSTS", {
				BODHA_ALLOWED_LLM_HOSTS: "legacy.example",
			})
		).toBeUndefined();
		expect(
			matiEnv("PROGRESS_TIMEZONE", {
				MATI_PROGRESS_TIMEZONE: "  ",
				BODHA_PROGRESS_TIMEZONE: "Asia/Kolkata",
			})
		).toBeUndefined();
	});

	it("does not interpolate BODHA_* names", () => {
		const source = readFileSync(
			new URL("./mati-env.ts", import.meta.url),
			"utf8"
		);
		expect(source).not.toMatch(/BODHA_\$\{/);
		expect(source).not.toMatch(/`BODHA_/);
	});
});
