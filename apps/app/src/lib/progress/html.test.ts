import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emptyProgressView, seededProgressView } from "./fixture";
import { progressDocument } from "./html";

describe("progressDocument", () => {
	it("writes empty and seeded Progress HTML for screenshots", () => {
		const empty = progressDocument(emptyProgressView(), "Progress empty");
		const seeded = progressDocument(seededProgressView(), "Progress seeded");
		expect(empty).toContain("No trainer tasks yet");
		expect(empty).toContain("No claimed editor tasks yet");
		expect(seeded).toContain("omitted, not guessed");
		expect(seeded).toContain("Which test fails first?");
		expect(seeded).toContain("Reported by the trainer provider");
		expect(seeded).toContain("12 in / 4 out");
		expect(seeded).toContain("Fix the flaky test");
		expect(seeded).toContain("Estimated from text length");
		expect(seeded).toContain("Editor");
		const dir = "/opt/cursor/artifacts";
		mkdirSync(dir, { recursive: true });
		writeFileSync(`${dir}/progress-empty.html`, empty);
		writeFileSync(`${dir}/progress-seeded.html`, seeded);
		writeFileSync(`${dir}/progress-editor.html`, seeded);
	});
});
