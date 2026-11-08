import { describe, expect, it, vi } from "vitest";
import { fetchApprovedEndpoint } from "./transport";

describe("fetchApprovedEndpoint", () => {
	it("refuses redirects off the approved origin", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(null, {
						status: 302,
						headers: { location: "http://127.0.0.1/secret" },
					}),
			),
		);
		await expect(
			fetchApprovedEndpoint(
				{
					href: "https://api.openai.com/v1",
					origin: "https://api.openai.com",
					host: "api.openai.com",
				},
				"/models",
			),
		).rejects.toThrow(/redirected off the approved origin/);
		vi.unstubAllGlobals();
	});

	it("refuses metadata-style redirects even when location is relative to another host", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(null, {
						status: 301,
						headers: { location: "https://metadata.google.internal/" },
					}),
			),
		);
		await expect(
			fetchApprovedEndpoint(
				{
					href: "https://api.openai.com/v1",
					origin: "https://api.openai.com",
					host: "api.openai.com",
				},
				"/models",
			),
		).rejects.toThrow(/approved origin/);
		vi.unstubAllGlobals();
	});
});
