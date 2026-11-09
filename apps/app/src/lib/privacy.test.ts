import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("privacy regressions", () => {
	it("does not persist provider keys in localStorage helpers", () => {
		const source = readFileSync(
			new URL("./storage.ts", import.meta.url),
			"utf8"
		);
		expect(source).not.toMatch(
			/localStorage\.(getItem|setItem|removeItem)\([^)]*apiKey/
		);
		expect(source).not.toMatch(/cc\.apiKey\s*=/);
	});

	it("does not call providers from the browser trainer panel", () => {
		const source = readFileSync(
			new URL("../components/AiPanel.tsx", import.meta.url),
			"utf8"
		);
		expect(source).not.toMatch(/generativelanguage\.googleapis/);
		expect(source).not.toMatch(/api\.anthropic\.com/);
		expect(source).toMatch(/\/api\/sessions\/\$\{sessionId\}\/chat/);
	});

	it("binds credential AAD to owner plus provider config", () => {
		const source = readFileSync(
			new URL("./crypto/credentials.ts", import.meta.url),
			"utf8"
		);
		expect(source).toMatch(/provider/);
		expect(source).toMatch(/binding\.model/);
		expect(source).not.toMatch(/setAAD\(Buffer\.from\(ownerId, "utf8"\)\)/);
	});

	it("does not upsert immutable evidence or snapshots", () => {
		const service = readFileSync(
			new URL("./sessions/service.ts", import.meta.url),
			"utf8"
		);
		const queries = readFileSync(
			new URL("./db/queries.ts", import.meta.url),
			"utf8"
		);
		expect(service).not.toMatch(/\.upsert\(/);
		expect(queries).toMatch(/insertOnce/);
		expect(queries).not.toMatch(/evidenceEvent\.upsert/);
		expect(queries).not.toMatch(/exerciseSnapshot\.upsert/);
	});

	it("does not write llm_settings.base_url on upsert", () => {
		const queries = readFileSync(
			new URL("./db/queries.ts", import.meta.url),
			"utf8"
		);
		const upsert = queries.slice(
			queries.indexOf("export async function upsertLlmSettings")
		);
		expect(upsert).not.toMatch(/baseUrl/);
		expect(upsert).not.toMatch(/base_url/);
	});

	it("does not use anonymous Auth for capture ingest", () => {
		const auth = readFileSync(
			new URL("./capture/auth.ts", import.meta.url),
			"utf8"
		);
		const ingest = readFileSync(
			new URL("./capture/ingest.ts", import.meta.url),
			"utf8"
		);
		expect(auth).toMatch(/withDeviceDb/);
		expect(auth).toMatch(/withCaptureRegisterDb/);
		expect(auth).not.toMatch(/withAnonDb/);
		expect(ingest).not.toMatch(/withAnonDb/);
	});

	it("keeps llm-settings GET on the ciphertext-free status path", () => {
		const source = readFileSync(
			new URL("../app/api/llm-settings/route.ts", import.meta.url),
			"utf8"
		);
		const getHandler = source.slice(
			source.indexOf("export async function GET"),
			source.indexOf("export async function PUT")
		);
		expect(getHandler).toMatch(/getMaskedSettings/);
		expect(getHandler).not.toMatch(/encrypted_api_key/);
		expect(getHandler).not.toMatch(/from\("llm_settings"\)/);
	});
});
