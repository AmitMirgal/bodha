import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeCaptureGate } from "./capture-gate";
import {
	collectCaptureDiagnosis,
	countQueueLines,
	formatDiagnosis,
	writeLastUpload,
} from "./diagnose";

const originalHome = process.env.MATI_HOME;
const originalHooks = process.env.MATI_CURSOR_HOOKS_PATH;
const originalCopilot = process.env.MATI_COPILOT_HOOKS_PATH;

afterEach(() => {
	process.env.MATI_HOME = originalHome;
	process.env.MATI_CURSOR_HOOKS_PATH = originalHooks;
	process.env.MATI_COPILOT_HOOKS_PATH = originalCopilot;
});

describe("capture diagnosis", () => {
	it("reports server URL, device, gate, hooks path, queue count, and last upload", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "mati-diagnose-"));
		const hooksPath = path.join(dir, "hooks.json");
		const copilotPath = path.join(dir, "copilot", "mati.json");
		process.env.MATI_HOME = dir;
		process.env.MATI_CURSOR_HOOKS_PATH = hooksPath;
		process.env.MATI_COPILOT_HOOKS_PATH = copilotPath;
		writeCaptureGate(
			{
				capturing: true,
				deviceId: "dev-1",
				holders: [{ id: "w1", updatedAt: Date.now() }],
			},
			{ matiHome: dir }
		);
		writeFileSync(
			hooksPath,
			JSON.stringify({
				hooks: {
					beforeSubmitPrompt: [{ command: "./hooks/mati-capture.sh" }],
				},
				version: 1,
			})
		);
		mkdirSync(path.join(dir, "queue"), { recursive: true });
		writeFileSync(path.join(dir, "queue", "dev-1.jsonl"), "{}\n{}\n");
		writeLastUpload(
			{
				at: "2026-11-10T12:00:00.000Z",
				failed: 0,
				ok: true,
				origin: "https://mati-tau.vercel.app",
				posted: 2,
			},
			dir
		);
		const diagnosis = collectCaptureDiagnosis({
			deviceId: "dev-1",
			matiHome: dir,
			serverUrl: "https://mati-tau.vercel.app",
			workspaceHash: "abc",
		});
		expect(diagnosis.cursorHooksHasMati).toBe(true);
		expect(diagnosis.deviceRegistered).toBe(true);
		expect(diagnosis.gate?.capturing).toBe(true);
		expect(diagnosis.queueCount).toBe(2);
		expect(countQueueLines(diagnosis.queuePath)).toBe(2);
		expect(diagnosis.serverUrl).toBe("https://mati-tau.vercel.app");
		const text = formatDiagnosis(diagnosis);
		expect(text).toContain("Server URL: https://mati-tau.vercel.app");
		expect(text).toContain("Device registered: yes");
		expect(text).toContain("capturing=true");
		expect(text).toContain("hasMati=true");
		expect(text).toContain("Queue: 2 line(s)");
		expect(text).toContain("posted=2");
	});
});
