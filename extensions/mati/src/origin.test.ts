import { describe, expect, it } from "vitest";
import {
	describeFetchError,
	resolveMatiOrigin,
	stripTrailingSlash,
} from "./origin";

describe("resolveMatiOrigin", () => {
	it("prefers env, then setting, then secret, then fallback", () => {
		expect(
			resolveMatiOrigin({
				envOrigin: "https://env.example/",
				secretOrigin: "https://secret.example",
				settingOrigin: "https://setting.example/",
			})
		).toBe("https://env.example");
		expect(
			resolveMatiOrigin({
				secretOrigin: "https://secret.example/",
				settingOrigin: "https://setting.example",
			})
		).toBe("https://setting.example");
		expect(
			resolveMatiOrigin({
				secretOrigin: "https://secret.example/",
			})
		).toBe("https://secret.example");
		expect(resolveMatiOrigin({})).toBe("https://mati-tau.vercel.app");
		expect(
			resolveMatiOrigin({
				envOrigin: "http://127.0.0.1:3000",
			})
		).toBe("http://127.0.0.1:3000");
	});

	it("strips trailing slashes", () => {
		expect(stripTrailingSlash("https://app.example.com///")).toBe(
			"https://app.example.com"
		);
	});
});

describe("describeFetchError", () => {
	it("includes the origin and HTTP status", () => {
		expect(
			describeFetchError("register this device", "https://app.example.com", {
				kind: "http",
				status: 500,
			})
		).toBe(
			"Could not register this device at https://app.example.com (HTTP 500)."
		);
	});

	it("includes a redacted network error", () => {
		expect(
			describeFetchError("register this device", "https://app.example.com", {
				kind: "network",
				message: "fetch failed Bearer tok_live_abc",
			})
		).toBe(
			"Could not register this device at https://app.example.com (fetch failed Bearer [redacted])."
		);
	});
});
