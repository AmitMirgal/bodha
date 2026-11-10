import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	captureGatePath,
	claimCaptureHolder,
	clearCaptureGate,
	HOLDER_STALE_MS,
	normalizeCaptureGate,
	readCaptureGate,
	releaseCaptureHolder,
	shouldEnqueueFromGate,
	updateCaptureGate,
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
			{ capturing: true, holders: [], workspaceHash: "abc" },
			{ matiHome: dir }
		);
		expect(readCaptureGate(captureGatePath(dir))).toEqual({
			capturing: true,
			deviceId: undefined,
			holders: [],
			workspaceHash: "abc",
		});
	});

	it("stays capturing while any window holds the gate", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "mati-gate-holders-"));
		const now = Date.now();
		claimCaptureHolder(
			{ id: "window-a", updatedAt: now, workspaceHash: "ws-a" },
			{ deviceId: "dev-1", matiHome: dir, workspaceHash: "ws-a" }
		);
		claimCaptureHolder(
			{ id: "window-b", updatedAt: now, workspaceHash: "ws-b" },
			{ matiHome: dir, workspaceHash: "ws-b" }
		);
		const afterOtherWindowCloses = releaseCaptureHolder("window-b", {
			matiHome: dir,
		});
		expect(afterOtherWindowCloses.capturing).toBe(true);
		expect(afterOtherWindowCloses.deviceId).toBe("dev-1");
		expect(afterOtherWindowCloses.holders?.map((holder) => holder.id)).toEqual([
			"window-a",
		]);
		expect(releaseCaptureHolder("window-a", { matiHome: dir }).capturing).toBe(
			false
		);
	});

	it("does not let an unconsented window clear another window's holder", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "mati-gate-unconsent-"));
		const now = Date.now();
		claimCaptureHolder(
			{ id: "capturing-window", updatedAt: now, workspaceHash: "ws-a" },
			{ deviceId: "dev-1", matiHome: dir, workspaceHash: "ws-a" }
		);
		const afterStranger = releaseCaptureHolder("other-window", {
			matiHome: dir,
		});
		expect(afterStranger.capturing).toBe(true);
		expect(afterStranger.holders?.[0]?.id).toBe("capturing-window");
	});

	it("drops stale holders and can clear the gate", () => {
		const stale = normalizeCaptureGate(
			{
				capturing: true,
				holders: [{ id: "old", updatedAt: 1, workspaceHash: "ws" }],
			},
			HOLDER_STALE_MS + 10
		);
		expect(stale.capturing).toBe(false);
		expect(stale.holders).toEqual([]);
		const dir = mkdtempSync(path.join(tmpdir(), "mati-gate-clear-"));
		claimCaptureHolder(
			{ id: "window-a", updatedAt: Date.now() },
			{ matiHome: dir }
		);
		expect(clearCaptureGate({ matiHome: dir }).capturing).toBe(false);
		expect(
			updateCaptureGate((gate) => gate, { matiHome: dir }).holders
		).toEqual([]);
	});
});
