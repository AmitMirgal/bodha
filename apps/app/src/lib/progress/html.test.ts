import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emptyProgressView, seededProgressView } from "./fixture";
import {
	progressDocument,
	progressLoadingDocument,
	progressTaskDocument,
} from "./html";

describe("progressDocument", () => {
	it("writes empty and seeded Progress HTML for screenshots", () => {
		const empty = progressDocument(emptyProgressView(), "Progress empty");
		const emptyDark = progressDocument(
			emptyProgressView(),
			"Progress empty dark",
			"dark"
		);
		const seeded = progressDocument(seededProgressView(), "Progress seeded");
		const seededDark = progressDocument(
			seededProgressView(),
			"Progress seeded dark",
			"dark"
		);
		const loading = progressLoadingDocument("light");
		const loadingDark = progressLoadingDocument("dark");
		const detailTask = seededProgressView().tasks.find(
			(task) => task.suggestions.length > 0
		);
		if (!detailTask) {
			throw new Error("expected a seeded task with suggestions");
		}
		const detail = progressTaskDocument(detailTask, "Progress task detail");
		const detailDark = progressTaskDocument(
			detailTask,
			"Progress task detail dark",
			"dark"
		);
		expect(empty).toContain("No tasks yet");
		expect(empty).toContain("Not reported");
		expect(empty).toContain("No harness runs");
		expect(emptyDark).toContain('data-theme="dark"');
		expect(seeded).toContain("omitted, not guessed");
		expect(seeded).toContain("Which test fails first?");
		expect(seeded).toContain("Reported by the trainer provider");
		expect(seeded).toContain("12 in / 4 out");
		expect(seeded).toContain("Fix the flaky test");
		expect(seeded).toContain("Estimated from text length");
		expect(seeded).toContain("Cursor");
		expect(seeded).toContain("Try next:");
		expect(loading).toContain("Loading progress");
		expect(detail).toContain("Prompt timeline");
		expect(detail).toContain("Per-prompt vendor tokens were not stored");
		expect(detail).toContain("Which test fails first?");
		const dir = "/opt/cursor/artifacts";
		mkdirSync(dir, { recursive: true });
		writeFileSync(`${dir}/progress-empty.html`, empty);
		writeFileSync(`${dir}/progress-empty-dark.html`, emptyDark);
		writeFileSync(`${dir}/progress-seeded.html`, seeded);
		writeFileSync(`${dir}/progress-seeded-dark.html`, seededDark);
		writeFileSync(`${dir}/progress-editor.html`, seeded);
		writeFileSync(`${dir}/progress-loading.html`, loading);
		writeFileSync(`${dir}/progress-loading-dark.html`, loadingDark);
		writeFileSync(`${dir}/progress-task-detail.html`, detail);
		writeFileSync(`${dir}/progress-task-detail-dark.html`, detailDark);
	});
});
