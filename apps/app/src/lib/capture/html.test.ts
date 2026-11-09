import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { captureViewerDocument } from "./html";

const ARTIFACTS = "/opt/cursor/artifacts";

function writeViewer(name: string, html: string): string {
	mkdirSync(ARTIFACTS, { recursive: true });
	const htmlPath = `${ARTIFACTS}/${name}.html`;
	writeFileSync(htmlPath, html);
	return htmlPath;
}

function screenshot(name: string, htmlPath: string): string | null {
	const pngPath = `${ARTIFACTS}/${name}.png`;
	const userData = `/tmp/chrome-capture-${name}`;
	try {
		execFileSync(
			"timeout",
			[
				"--kill-after=1",
				"5",
				"google-chrome",
				"--headless=old",
				`--user-data-dir=${userData}`,
				"--disable-gpu",
				"--remote-debugging-port=0",
				"--window-size=1280,900",
				`--screenshot=${pngPath}`,
				`file://${htmlPath}`,
			],
			{ timeout: 8000, stdio: "pipe" }
		);
		return pngPath;
	} catch {
		return null;
	}
}

describe("capture viewer document", () => {
	it("renders empty and seeded states", () => {
		const empty = captureViewerDocument([]);
		expect(empty).toContain("No captured Agent prompts yet.");
		expect(empty).toContain("Totals are omitted, not guessed.");
		const seeded = captureViewerDocument([
			{
				editor: "cursor",
				editorTaskId: "conv-1",
				id: "task-1",
				prompts: ["Fix the flaky test"],
				status: "closed",
			},
		]);
		expect(seeded).toContain("Fix the flaky test");
		expect(seeded).not.toContain("0 tokens");
		writeViewer("capture-viewer-empty", empty);
		writeViewer("capture-viewer-seeded", seeded);
	});

	it("screenshots empty and seeded viewer HTML when Chrome is installed", () => {
		try {
			execFileSync("google-chrome", ["--version"], {
				timeout: 3000,
				stdio: "pipe",
			});
		} catch {
			return;
		}
		const emptyPath = `${ARTIFACTS}/capture-viewer-empty.html`;
		const seededPath = `${ARTIFACTS}/capture-viewer-seeded.html`;
		screenshot("capture-viewer-empty", emptyPath);
		screenshot("capture-viewer-seeded", seededPath);
		expect(existsSync(`${ARTIFACTS}/capture-viewer-empty.png`)).toBe(true);
		expect(existsSync(`${ARTIFACTS}/capture-viewer-seeded.png`)).toBe(true);
	}, 30_000);
});
