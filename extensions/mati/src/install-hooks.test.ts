import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	installCopilotHooks,
	installCursorHooks,
	mergeMatiHooks,
	removeMatiHooks,
	uninstallCopilotHooks,
	uninstallCursorHooks,
} from "./install-hooks";

describe("Cursor hooks.json merge", () => {
	it("adds Mati commands without dropping other hooks", () => {
		const merged = mergeMatiHooks(
			{
				version: 1,
				hooks: {
					beforeSubmitPrompt: [{ command: "other --hook" }],
				},
			},
			"node /tmp/.mati/hooks/cursor.mjs"
		);
		expect(
			merged.hooks.beforeSubmitPrompt?.map((entry) => entry.command)
		).toEqual(["other --hook", "node /tmp/.mati/hooks/cursor.mjs"]);
		expect(merged.hooks.afterAgentResponse?.[0]?.command).toContain(
			".mati/hooks/cursor.mjs"
		);
	});

	it("removes only the Mati block", () => {
		const removed = removeMatiHooks({
			version: 1,
			hooks: {
				beforeSubmitPrompt: [
					{ command: "other --hook" },
					{ command: "node /home/u/.mati/hooks/cursor.mjs" },
				],
			},
		});
		expect(removed.hooks.beforeSubmitPrompt).toEqual([
			{ command: "other --hook" },
		]);
	});

	it("writes and uninstalls a real hooks.json after consent paths", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "mati-hooks-"));
		const hooksPath = path.join(dir, "hooks.json");
		writeFileSync(
			hooksPath,
			JSON.stringify({
				version: 1,
				hooks: { stop: [{ command: "keep-me" }] },
			})
		);
		const source = path.resolve(import.meta.dirname, "../hooks/cursor.mjs");
		installCursorHooks({
			hookScriptSource: source,
			hooksPath,
			matiHome: path.join(dir, ".mati"),
		});
		const installed = JSON.parse(readFileSync(hooksPath, "utf8")) as {
			hooks: Record<string, Array<{ command: string }>>;
		};
		expect(installed.hooks.stop?.[0]?.command).toBe("keep-me");
		expect(installed.hooks.beforeSubmitPrompt?.[0]?.command).toContain(
			"cursor.mjs"
		);
		uninstallCursorHooks({ hooksPath });
		const cleaned = JSON.parse(readFileSync(hooksPath, "utf8")) as {
			hooks: Record<string, Array<{ command: string }>>;
		};
		expect(cleaned.hooks.beforeSubmitPrompt).toBeUndefined();
		expect(cleaned.hooks.stop?.[0]?.command).toBe("keep-me");
	});

	it("writes ~/.copilot/hooks/mati.json for both Copilot event names", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "mati-copilot-hooks-"));
		const hooksPath = path.join(dir, "mati.json");
		const source = path.resolve(import.meta.dirname, "../hooks/copilot.mjs");
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
		uninstallCopilotHooks({ hooksPath });
		expect(() => readFileSync(hooksPath, "utf8")).toThrow();
	});
});
