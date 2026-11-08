import { describe, expect, it, vi } from "vitest";
import { probeOpenAiCompatible } from "./capabilities";

describe("probeOpenAiCompatible", () => {
	it("marks tools supported only after a tools handshake, not from /models alone", async () => {
		const fetchMock = vi.fn(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				if (url.endsWith("/models")) {
					return Response.json({ data: [{ id: "gpt-4.1" }] });
				}
				if (url.endsWith("/chat/completions")) {
					const body = JSON.parse(String(init?.body ?? "{}")) as {
						tools?: unknown[];
					};
					expect(body.tools?.length).toBeGreaterThan(0);
					expect(JSON.stringify(body)).not.toContain("sk-test-sentinel");
					return Response.json({ choices: [{ message: { content: "." } }] });
				}
				return new Response("missing", { status: 404 });
			},
		);
		vi.stubGlobal("fetch", fetchMock);
		const result = await probeOpenAiCompatible(
			{
				href: "https://api.openai.com/v1",
				origin: "https://api.openai.com",
				host: "api.openai.com",
			},
			"sk-test-sentinel",
			"gpt-4.1",
		);
		expect(result.capabilities.tools).toBe("supported");
		expect(result.error).toBeUndefined();
		vi.unstubAllGlobals();
	});

	it("does not fall back to one-shot when the tools handshake is rejected", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				if (url.endsWith("/models")) {
					return Response.json({ data: [{ id: "gpt-4.1" }] });
				}
				return new Response("tools is not supported", { status: 400 });
			}),
		);
		const result = await probeOpenAiCompatible(
			{
				href: "https://api.openai.com/v1",
				origin: "https://api.openai.com",
				host: "api.openai.com",
			},
			"sk-test-sentinel",
			"gpt-4.1",
		);
		expect(result.capabilities.tools).toBe("unsupported");
		expect(result.error).toMatch(/will not fall back/);
		vi.unstubAllGlobals();
	});
});
