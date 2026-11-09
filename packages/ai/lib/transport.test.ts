import { describe, expect, it, vi } from "vitest";
import { createProtectedFetch, fetchApprovedEndpoint } from "./transport";

describe("protected LLM transport", () => {
	it("refuses redirects off the approved origin", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() =>
				Promise.resolve(Response.redirect("http://127.0.0.1/secret", 302))
			)
		);
		await expect(
			fetchApprovedEndpoint(
				{
					href: "https://api.openai.com/v1",
					origin: "https://api.openai.com",
					host: "api.openai.com",
				},
				"/models"
			)
		).rejects.toThrow(/redirected off the approved origin/);
		vi.unstubAllGlobals();
	});

	it("refuses metadata-style redirects even when location is relative to another host", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() =>
				Promise.resolve(
					Response.redirect("https://metadata.google.internal/", 301)
				)
			)
		);
		await expect(
			fetchApprovedEndpoint(
				{
					href: "https://api.openai.com/v1",
					origin: "https://api.openai.com",
					host: "api.openai.com",
				},
				"/models"
			)
		).rejects.toThrow(/approved origin/);
		vi.unstubAllGlobals();
	});

	it("pins generation requests to the approved origin and keeps secrets out of the URL", async () => {
		const fetchMock = vi.fn((input: RequestInfo | URL) => {
			const url = String(input);
			expect(url).toBe("https://api.openai.com/v1/chat/completions");
			expect(url).not.toContain("sk-test-sentinel");
			return Promise.resolve(Response.json({ ok: true }));
		});
		vi.stubGlobal("fetch", fetchMock);
		const protectedFetch = createProtectedFetch({
			href: "https://api.openai.com/v1",
			origin: "https://api.openai.com",
			host: "api.openai.com",
		});
		await protectedFetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: { authorization: "Bearer sk-test-sentinel" },
		});
		await expect(
			protectedFetch("https://evil.example/v1/chat/completions")
		).rejects.toThrow(/approved origin/);
		vi.unstubAllGlobals();
	});

	it("allows an explicit loopback IP only when that IP is the approved endpoint host", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => Promise.resolve(Response.json({ ok: true })))
		);
		const loopback = createProtectedFetch({
			href: "http://127.0.0.1:9/v1",
			origin: "http://127.0.0.1:9",
			host: "127.0.0.1",
		});
		await expect(
			loopback("http://127.0.0.1:9/v1/chat/completions")
		).resolves.toBeTruthy();
		await expect(
			loopback("http://10.0.0.1:9/v1/chat/completions")
		).rejects.toThrow(/approved origin|approved endpoint host/);
		vi.unstubAllGlobals();
	});

	it("rejects responses that declare a body larger than the size limit", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() =>
				Promise.resolve(
					new Response("too-big", {
						headers: { "content-length": "3000000" },
					})
				)
			)
		);
		await expect(
			fetchApprovedEndpoint(
				{
					href: "https://api.openai.com/v1",
					origin: "https://api.openai.com",
					host: "api.openai.com",
				},
				"/models"
			)
		).rejects.toThrow(/size limit/);
		vi.unstubAllGlobals();
	});
});
