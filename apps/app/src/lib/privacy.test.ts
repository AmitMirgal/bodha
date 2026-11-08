import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("privacy regressions", () => {
	it("does not persist provider keys in localStorage helpers", () => {
		const source = readFileSync(
			new URL("./storage.ts", import.meta.url),
			"utf8",
		);
		expect(source).not.toMatch(
			/localStorage\.(getItem|setItem|removeItem)\([^)]*apiKey/,
		);
		expect(source).not.toMatch(/cc\.apiKey\s*=/);
	});

	it("does not call providers from the browser trainer panel", () => {
		const source = readFileSync(
			new URL("../components/AiPanel.tsx", import.meta.url),
			"utf8",
		);
		expect(source).not.toMatch(/generativelanguage\.googleapis/);
		expect(source).not.toMatch(/api\.anthropic\.com/);
		expect(source).toMatch(/\/api\/sessions\/\$\{sessionId\}\/chat/);
	});

	it("binds credential AAD to owner plus provider config", () => {
		const source = readFileSync(
			new URL("./crypto/credentials.ts", import.meta.url),
			"utf8",
		);
		expect(source).toMatch(/provider/);
		expect(source).toMatch(/baseUrl/);
		expect(source).not.toMatch(/setAAD\(Buffer\.from\(ownerId, "utf8"\)\)/);
	});

	it("does not upsert immutable evidence or snapshots", () => {
		const source = readFileSync(
			new URL("./sessions/service.ts", import.meta.url),
			"utf8",
		);
		expect(source).not.toMatch(/\.upsert\(/);
		expect(source).toMatch(/insertOnce/);
	});

	it("keeps llm-settings GET on the ciphertext-free status path", () => {
		const source = readFileSync(
			new URL("../app/api/llm-settings/route.ts", import.meta.url),
			"utf8",
		);
		const getHandler = source.slice(
			source.indexOf("export async function GET"),
			source.indexOf("export async function PUT"),
		);
		expect(getHandler).toMatch(/getMaskedSettings/);
		expect(getHandler).not.toMatch(/encrypted_api_key/);
		expect(getHandler).not.toMatch(/from\("llm_settings"\)/);
	});
});
