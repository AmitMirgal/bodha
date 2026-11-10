import { describe, expect, it } from "vitest";
import {
	activateCapturePlan,
	captureStatus,
	idleMinutesFromSetting,
	planAfterCommand,
	shouldAutoStart,
	shouldPromptConsent,
	statusBarLabel,
} from "./capture-state";

describe("workspace consent and auto-start", () => {
	it("auto-starts when this workspace has consented and is not paused", () => {
		expect(shouldAutoStart({ paused: false, workspaceConsented: true })).toBe(
			true
		);
		expect(
			captureStatus({
				paused: false,
				sessionActive: true,
				workspaceConsented: true,
			})
		).toBe("capturing");
		expect(shouldPromptConsent(true)).toBe(false);
	});

	it("does not auto-start without workspace consent", () => {
		expect(shouldAutoStart({ paused: false, workspaceConsented: false })).toBe(
			false
		);
		expect(
			captureStatus({
				paused: false,
				sessionActive: false,
				workspaceConsented: false,
			})
		).toBe("not_consented");
		expect(shouldPromptConsent(false)).toBe(true);
		expect(
			planAfterCommand({ paused: false, workspaceConsented: false }, "start")
		).toEqual({
			autoStart: false,
			needsConsentUi: true,
			paused: false,
			status: "not_consented",
		});
	});

	it("keeps pause until resume, and maps start/stop onto resume/pause", () => {
		const afterStop = planAfterCommand(
			{ paused: false, workspaceConsented: true },
			"stop"
		);
		expect(afterStop).toEqual({
			autoStart: false,
			needsConsentUi: false,
			paused: true,
			status: "paused",
		});
		const stillPaused = planAfterCommand(
			{ paused: true, workspaceConsented: true },
			"stop"
		);
		expect(stillPaused.paused).toBe(true);
		expect(shouldAutoStart({ paused: true, workspaceConsented: true })).toBe(
			false
		);
		const afterStart = planAfterCommand(
			{ paused: true, workspaceConsented: true },
			"start"
		);
		expect(afterStart).toEqual({
			autoStart: true,
			needsConsentUi: false,
			paused: false,
			status: "capturing",
		});
		expect(
			planAfterCommand({ paused: false, workspaceConsented: true }, "toggle")
				.paused
		).toBe(true);
	});

	it("reads idle minutes from the setting with a 30 minute default", () => {
		expect(idleMinutesFromSetting(undefined)).toBe(30);
		expect(idleMinutesFromSetting(5)).toBe(5);
		expect(idleMinutesFromSetting(0)).toBe(1);
		expect(idleMinutesFromSetting(10_000)).toBe(24 * 60);
		expect(statusBarLabel("capturing").command).toBe(
			"mati.capture.statusToggle"
		);
		expect(statusBarLabel("not_consented").command).toBe(
			"mati.capture.consent"
		);
	});

	it("re-arms a consented unpaused workspace on activate even if the gate is empty", () => {
		expect(
			activateCapturePlan({ paused: false, workspaceConsented: true })
		).toBe("start");
		expect(shouldAutoStart({ paused: false, workspaceConsented: true })).toBe(
			true
		);
		expect(
			activateCapturePlan({ paused: true, workspaceConsented: true })
		).toBe("idle");
		expect(
			activateCapturePlan({ paused: false, workspaceConsented: false })
		).toBe("prompt");
	});

	it("does not show capturing when the gate is off or hooks are missing", () => {
		expect(
			captureStatus({
				gateCapturing: false,
				hooksInstalled: true,
				paused: false,
				sessionActive: true,
				workspaceConsented: true,
			})
		).toBe("misconfigured");
		expect(
			captureStatus({
				gateCapturing: true,
				hooksInstalled: false,
				paused: false,
				sessionActive: true,
				workspaceConsented: true,
			})
		).toBe("misconfigured");
		expect(statusBarLabel("misconfigured").command).toBe(
			"mati.capture.diagnose"
		);
	});
});
