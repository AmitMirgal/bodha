import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { captureSettingsDocument } from "./settings-html";

const ARTIFACTS = "/opt/cursor/artifacts";

function writeDoc(name: string, html: string): string {
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

describe("capture settings document", () => {
	it("renders pairing code and claimed-device delete copy", () => {
		const html = captureSettingsDocument({
			code: "AB23K7NP",
			deviceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		});
		expect(html).toContain("AB23K7NP");
		expect(html).toContain("Mati: Claim this device");
		expect(html).toContain("Delete editor capture");
		expect(html).toContain("Trainer sessions are not deleted");
		writeDoc("capture-settings-claim", html);
	});

	it("screenshots settings HTML when Chrome is installed", () => {
		try {
			execFileSync("google-chrome", ["--version"], {
				timeout: 3000,
				stdio: "pipe",
			});
		} catch {
			return;
		}
		screenshot(
			"capture-settings-claim",
			`${ARTIFACTS}/capture-settings-claim.html`
		);
		expect(existsSync(`${ARTIFACTS}/capture-settings-claim.png`)).toBe(true);
	}, 30_000);
});
