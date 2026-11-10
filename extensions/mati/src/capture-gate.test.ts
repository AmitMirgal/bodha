import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	captureGatePath,
	readCaptureGate,
	shouldEnqueueFromGate,
	writeCaptureGate,
} from "./capture-gate";

describe("capture gate", () => {
	it("does not enqueue until capturing is explicitly enabled", () => {
		expect(shouldEnqueueFromGate(null)).toBe(false);
		expect(shouldEnqueueFromGate({ capturing: false })).toBe(false);
		expect(shouldEnqueueFromGate({ capturing: true })).toBe(true);
	});

	it("round-trips the gate file used by hook scripts", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "mati-gate-"));
		writeCaptureGate(
			{ capturing: true, workspaceHash: "abc" },
			{ matiHome: dir }
		);
		expect(readCaptureGate(captureGatePath(dir))).toEqual({
			capturing: true,
			deviceId: undefined,
			workspaceHash: "abc",
		});
	});
});
