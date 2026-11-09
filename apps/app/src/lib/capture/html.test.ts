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
		expect(empty).toContain("text-length estimate and undercounts");
		const seeded = captureViewerDocument([
			{
				editor: "cursor",
				editorTaskId: "conv-1",
				filePaths: ["app.ts"],
				id: "task-1",
				prompts: ["Fix the flaky test"],
				status: "closed",
				usage: [
					{
						cachedTokens: null,
						inputTokens: 5,
						outputTokens: 2,
						provenance: "estimated",
						source: "text_estimate",
					},
				],
			},
		]);
		expect(seeded).toContain("Fix the flaky test");
		expect(seeded).toContain("Estimated from text length");
		expect(seeded).toContain("This undercounts");
		expect(seeded).toContain("app.ts");
		expect(seeded).not.toContain("0 tokens");
		writeViewer("capture-viewer-estimate", seeded);
	});

	it("screenshots estimated viewer HTML", () => {
		const seededPath = `${ARTIFACTS}/capture-viewer-estimate.html`;
		screenshot("capture-viewer-estimate", seededPath);
		expect(existsSync(`${ARTIFACTS}/capture-viewer-estimate.png`)).toBe(true);
	}, 30_000);
});
