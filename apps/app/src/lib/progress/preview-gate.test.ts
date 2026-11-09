import { afterEach, describe, expect, it } from "vitest";
import { progressFixtureEnabled } from "./preview-gate";

const originalFixture = process.env.MATI_PROGRESS_FIXTURE;
const originalVercel = process.env.VERCEL_ENV;

afterEach(() => {
	process.env.MATI_PROGRESS_FIXTURE = originalFixture;
	process.env.VERCEL_ENV = originalVercel;
});

describe("progressFixtureEnabled", () => {
	it("is off by default", () => {
		process.env.MATI_PROGRESS_FIXTURE = undefined;
		process.env.VERCEL_ENV = undefined;
		expect(progressFixtureEnabled()).toBe(false);
	});

	it("is on only when the local fixture flag is set", () => {
		process.env.MATI_PROGRESS_FIXTURE = "1";
		process.env.VERCEL_ENV = undefined;
		expect(progressFixtureEnabled()).toBe(true);
	});

	it("stays off in Vercel production even if the flag is set", () => {
		process.env.MATI_PROGRESS_FIXTURE = "1";
		process.env.VERCEL_ENV = "production";
		expect(progressFixtureEnabled()).toBe(false);
	});
});
