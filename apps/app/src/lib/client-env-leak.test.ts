import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const SERVER_ENV = /process\.env\.(?!NEXT_PUBLIC_)[A-Z][A-Z0-9_]*/g;

function walk(dir: string): string[] {
	const entries = readdirSync(dir);
	const files: string[] = [];
	for (const entry of entries) {
		const full = path.join(dir, entry);
		const stat = statSync(full);
		if (stat.isDirectory()) {
			if (entry === "generated") {
				continue;
			}
			files.push(...walk(full));
			continue;
		}
		if (full.endsWith(".ts") || full.endsWith(".tsx")) {
			files.push(full);
		}
	}
	return files;
}

describe("client modules do not read server-only env", () => {
	it("keeps MATI_/DATABASE_URL out of use client files", () => {
		const leaks: string[] = [];
		for (const file of walk(SRC)) {
			const source = readFileSync(file, "utf8");
			if (!source.includes('"use client"')) {
				continue;
			}
			const matches = source.match(SERVER_ENV) ?? [];
			for (const match of matches) {
				leaks.push(`${path.relative(SRC, file)}:${match}`);
			}
		}
		expect(leaks).toEqual([]);
	});
});
