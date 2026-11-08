import { describe, expect, it, vi } from "vitest";

vi.mock("node:dns", () => ({
	promises: {
		lookup: vi.fn((host: string) => {
			if (host === "evil.example") {
				return Promise.resolve([{ address: "127.0.0.1", family: 4 }]);
			}
			return Promise.resolve([{ address: "1.1.1.1", family: 4 }]);
		}),
	},
}));

import { isPrivateIpv4, validateLlmEndpoint } from "./endpoint";

describe("endpoint validation", () => {
	it("detects private ipv4", () => {
		expect(isPrivateIpv4("127.0.0.1")).toBe(true);
		expect(isPrivateIpv4("10.0.0.4")).toBe(true);
		expect(isPrivateIpv4("1.1.1.1")).toBe(false);
	});

	it("rejects http, credentials, and unlisted hosts", async () => {
		await expect(
			validateLlmEndpoint("http://api.openai.com/v1", ["api.openai.com"]),
		).rejects.toThrow(/HTTPS/);
		await expect(
			validateLlmEndpoint("https://user:pass@api.openai.com/v1", [
				"api.openai.com",
			]),
		).rejects.toThrow(/credentials/);
		await expect(
			validateLlmEndpoint("https://not-allowed.example/v1", ["api.openai.com"]),
		).rejects.toThrow(/not on the operator-approved/);
	});

	it("rejects DNS that resolves privately", async () => {
		await expect(
			validateLlmEndpoint("https://evil.example/v1", ["evil.example"]),
		).rejects.toThrow(/private/);
	});

	it("accepts an approved public host", async () => {
		const endpoint = await validateLlmEndpoint("https://api.openai.com/v1", [
			"api.openai.com",
		]);
		expect(endpoint.host).toBe("api.openai.com");
	});

	it("allows HTTP only for operator-approved public hosts", async () => {
		const endpoint = await validateLlmEndpoint(
			"http://api.openai.com/v1",
			["api.openai.com"],
			{ allowHttpForApprovedHosts: true },
		);
		expect(endpoint.href).toContain("http://api.openai.com");
		await expect(
			validateLlmEndpoint("http://127.0.0.1/v1", ["127.0.0.1"], {
				allowHttpForApprovedHosts: true,
			}),
		).rejects.toThrow(/not allowed|Private/);
	});
});
