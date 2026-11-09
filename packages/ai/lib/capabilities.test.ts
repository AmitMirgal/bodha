import { describe, expect, it, vi } from "vitest";
import { probeOpenAiCompatible } from "./capabilities";

describe("probeOpenAiCompatible", () => {
	it("marks tools supported only after an actual tool_calls handshake", async () => {
		const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.endsWith("/models")) {
				return Promise.resolve(Response.json({ data: [{ id: "gpt-4.1" }] }));
			}
			if (url.endsWith("/chat/completions")) {
				const body = JSON.parse(String(init?.body ?? "{}")) as {
					tool_choice?: unknown;
					tools?: unknown[];
				};
				expect(body.tools?.length).toBeGreaterThan(0);
				expect(JSON.stringify(body.tool_choice)).toContain(
					"mati_capability_ping"
				);
				expect(JSON.stringify(body)).not.toContain("sk-test-sentinel");
				return Promise.resolve(
					Response.json({
						choices: [
							{
								message: {
									tool_calls: [
										{
											id: "call_probe",
											type: "function",
											function: {
												name: "mati_capability_ping",
												arguments: "{}",
											},
										},
									],
								},
							},
						],
					})
				);
			}
			return Promise.resolve(new Response("missing", { status: 404 }));
		});
		vi.stubGlobal("fetch", fetchMock);
		const result = await probeOpenAiCompatible(
			{
				href: "https://api.openai.com/v1",
				origin: "https://api.openai.com",
				host: "api.openai.com",
			},
			"sk-test-sentinel",
			"gpt-4.1"
		);
		expect(result.capabilities.tools).toBe("supported");
		expect(result.error).toBeUndefined();
		vi.unstubAllGlobals();
	});

	it("does not treat tool_choice none or a 200 without tool_calls as proof", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn((input: RequestInfo | URL) => {
				const url = String(input);
				if (url.endsWith("/models")) {
					return Promise.resolve(Response.json({ data: [{ id: "gpt-4.1" }] }));
				}
				return Promise.resolve(
					Response.json({
						choices: [{ message: { content: "." } }],
					})
				);
			})
		);
		const result = await probeOpenAiCompatible(
			{
				href: "https://api.openai.com/v1",
				origin: "https://api.openai.com",
				host: "api.openai.com",
			},
			"sk-test-sentinel",
			"gpt-4.1"
		);
		expect(result.capabilities.tools).toBe("unknown");
		expect(result.error).toMatch(/tool_calls/);
		vi.unstubAllGlobals();
	});

	it("does not fall back to one-shot when the tools handshake is rejected", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn((input: RequestInfo | URL) => {
				const url = String(input);
				if (url.endsWith("/models")) {
					return Promise.resolve(Response.json({ data: [{ id: "gpt-4.1" }] }));
				}
				return Promise.resolve(
					new Response("tools is not supported", { status: 400 })
				);
			})
		);
		const result = await probeOpenAiCompatible(
			{
				href: "https://api.openai.com/v1",
				origin: "https://api.openai.com",
				host: "api.openai.com",
			},
			"sk-test-sentinel",
			"gpt-4.1"
		);
		expect(result.capabilities.tools).toBe("unsupported");
		expect(result.error).toMatch(/will not fall back/);
		vi.unstubAllGlobals();
	});
});
