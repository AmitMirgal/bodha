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
});
