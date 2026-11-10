import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	ensureCursorHooks,
	hooksFileHasMati,
	installCopilotHooks,
	installCursorHooks,
	mergeMatiHooks,
	readHooksFile,
	removeMatiHooks,
	uninstallCopilotHooks,
	uninstallCursorHooks,
} from "./install-hooks";

describe("Cursor hooks.json merge", () => {
	it("adds Mati commands without dropping other hooks", () => {
		const merged = mergeMatiHooks(
			{
				hooks: {
					beforeSubmitPrompt: [{ command: "other --hook" }],
				},
				version: 1,
			},
			"./hooks/mati-capture.sh"
		);
		expect(
			merged.hooks.beforeSubmitPrompt?.map((entry) => entry.command)
		).toEqual(["other --hook", "./hooks/mati-capture.sh"]);
		expect(merged.hooks.afterAgentResponse?.[0]?.command).toBe(
			"./hooks/mati-capture.sh"
		);
		expect(merged.hooks.stop?.[0]?.command).toBe("./hooks/mati-capture.sh");
		expect(hooksFileHasMati(merged)).toBe(true);
	});

	it("removes only the Mati block", () => {
		const removed = removeMatiHooks({
			hooks: {
				beforeSubmitPrompt: [
					{ command: "other --hook" },
					{ command: "node /home/u/.mati/hooks/cursor.mjs" },
					{ command: "./hooks/mati-capture.sh" },
				],
			},
			version: 1,
		});
		expect(removed.hooks.beforeSubmitPrompt).toEqual([
			{ command: "other --hook" },
		]);
	});

	it("creates hooks.json when missing and copies enqueue.mjs", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "mati-hooks-missing-"));
		const hooksPath = path.join(dir, "hooks.json");
		const source = path.resolve(import.meta.dirname, "../hooks", "cursor.mjs");
		const installed = installCursorHooks({
			hookScriptSource: source,
			hooksPath,
			matiHome: path.join(dir, ".mati"),
		});
		expect(existsSync(hooksPath)).toBe(true);
		expect(installed.command).toBe("./hooks/mati-capture.sh");
		const { existing } = readHooksFile(hooksPath);
		expect(hooksFileHasMati(existing)).toBe(true);
		expect(existsSync(path.join(dir, ".mati", "hooks", "enqueue.mjs"))).toBe(
			true
		);
		expect(existsSync(path.join(dir, "hooks", "mati", "enqueue.mjs"))).toBe(
			true
		);
		expect(existsSync(path.join(dir, "hooks", "mati", "cursor.mjs"))).toBe(
			true
		);
		expect(existsSync(path.join(dir, "hooks", "mati-capture.sh"))).toBe(true);
		const wrapper = readFileSync(
			path.join(dir, "hooks", "mati-capture.sh"),
			"utf8"
		);
		expect(wrapper).toContain(process.execPath);
		expect(wrapper).toContain("cursor.mjs");
	});

	it("writes and uninstalls a real hooks.json after consent paths", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "mati-hooks-"));
		const hooksPath = path.join(dir, "hooks.json");
		writeFileSync(
			hooksPath,
			JSON.stringify({
				hooks: { stop: [{ command: "keep-me" }] },
				version: 1,
			})
		);
		const source = path.resolve(import.meta.dirname, "../hooks", "cursor.mjs");
		installCursorHooks({
			hookScriptSource: source,
			hooksPath,
			matiHome: path.join(dir, ".mati"),
		});
		const installed = JSON.parse(readFileSync(hooksPath, "utf8")) as {
			hooks: Record<string, Array<{ command: string }>>;
		};
		expect(
			installed.hooks.stop?.some((entry) => entry.command === "keep-me")
		).toBe(true);
		expect(installed.hooks.beforeSubmitPrompt?.[0]?.command).toBe(
			"./hooks/mati-capture.sh"
		);
		uninstallCursorHooks({ hooksPath });
		const cleaned = JSON.parse(readFileSync(hooksPath, "utf8")) as {
			hooks: Record<string, Array<{ command: string }>>;
		};
		expect(cleaned.hooks.beforeSubmitPrompt).toBeUndefined();
		expect(cleaned.hooks.stop?.[0]?.command).toBe("keep-me");
		expect(existsSync(path.join(dir, "hooks", "mati-capture.sh"))).toBe(false);
	});

	it("re-merges when the Mati hook was stripped", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "mati-hooks-repair-"));
		const hooksPath = path.join(dir, "hooks.json");
		const source = path.resolve(import.meta.dirname, "../hooks", "cursor.mjs");
		const options = {
			hookScriptSource: source,
			hooksPath,
			matiHome: path.join(dir, ".mati"),
		};
		installCursorHooks(options);
		writeFileSync(hooksPath, JSON.stringify({ hooks: {}, version: 1 }));
		const ensured = ensureCursorHooks(options);
		expect(ensured.repaired).toBe(true);
		const { existing } = readHooksFile(hooksPath);
		expect(hooksFileHasMati(existing)).toBe(true);
		expect(ensureCursorHooks(options).repaired).toBe(false);
	});

	it("writes ~/.copilot/hooks/mati.json for both Copilot event names", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "mati-copilot-hooks-"));
		const hooksPath = path.join(dir, "mati.json");
		const source = path.resolve(import.meta.dirname, "../hooks", "copilot.mjs");
		installCopilotHooks({
			hookScriptSource: source,
			hooksPath,
			matiHome: path.join(dir, ".mati"),
		});
		const installed = JSON.parse(readFileSync(hooksPath, "utf8")) as {
			hooks: Record<string, Array<{ bash: string; type: string }>>;
		};
		expect(installed.hooks.userPromptSubmitted?.[0]?.type).toBe("command");
		expect(installed.hooks.UserPromptSubmit?.[0]?.bash).toContain(
			"copilot.mjs"
		);
		expect(installed.hooks.Stop?.[0]?.bash).toContain("copilot.mjs");
		expect(existsSync(path.join(dir, ".mati", "hooks", "enqueue.mjs"))).toBe(
			true
		);
		uninstallCopilotHooks({ hooksPath });
		expect(() => readFileSync(hooksPath, "utf8")).toThrow();
	});
});
