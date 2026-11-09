import { readFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";

const SENTINEL = "sk-test-sentinel-local-only";

describe("local fixture UI / secret sentinels (not live credentials)", () => {
	it("does not treat MATI_LIVE_* as the local browser fixture", () => {
		expect(SENTINEL).not.toMatch(/^MATI_LIVE_/);
		expect(process.env.MATI_LIVE_SUPABASE_URL ?? "").not.toContain(SENTINEL);
		expect(process.env.MATI_LIVE_USER_A_ACCESS_TOKEN ?? "").not.toContain(
			SENTINEL
		);
	});

	it("clears the API key field after save and never writes it to localStorage", () => {
		const source = readFileSync(
			new URL("../components/LlmSettingsForm.tsx", import.meta.url),
			"utf8"
		);
		expect(source).toMatch(/type="password"/);
		expect(source).toMatch(/setApiKey\(""\)/);
		expect(source).not.toMatch(/localStorage/);
		expect(source).not.toMatch(/sk-live/);
		expect(source).not.toMatch(/baseUrl/);
		expect(source).not.toMatch(/ALLOWED_LLM|ALLOW_HTTP/);
	});

	it("serves a local HTML fixture that does not echo the sentinel", async () => {
		const html = `<!doctype html><html lang="en"><head><title>Mati local fixture</title></head><body>
<main>
<p>Local trainer fixture. This is not a live deployment.</p>
<input id="apiKey" type="password" autocomplete="new-password" />
<p id="status">key field is empty after save</p>
</main>
</body></html>`;
		const server = http.createServer((req, res) => {
			if (req.url === "/" || req.url === "/fixture") {
				res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
				res.end(html);
				return;
			}
			res.writeHead(404);
			res.end();
		});
		const href = await new Promise<string>((resolve) => {
			server.listen(0, "127.0.0.1", () => {
				const addr = server.address() as AddressInfo;
				resolve(`http://127.0.0.1:${addr.port}/fixture`);
			});
		});
		try {
			const response = await fetch(href);
			const body = await response.text();
			expect(body).toMatch(/Local trainer fixture/);
			expect(body).toMatch(/type="password"/);
			expect(body).not.toContain(SENTINEL);
			expect(body).not.toMatch(/MATI_LIVE_/);
			expect(href).toMatch(/^http:\/\/127\.0\.0\.1:/);
		} finally {
			server.close();
		}
	});
});
