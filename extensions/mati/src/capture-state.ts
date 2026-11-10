export type CaptureStatus =
	| "capturing"
	| "misconfigured"
	| "not_consented"
	| "off"
	| "paused";

export const CONSENT_KEY = "mati.consent.v1";
export const PAUSED_KEY = "mati.paused";
export const BOUNDARY_KEY = "mati.taskBoundary";
export const DEFAULT_IDLE_MINUTES = 30;
export const MIN_IDLE_MINUTES = 1;
export const MAX_IDLE_MINUTES = 24 * 60;

export function idleMinutesFromSetting(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) {
		return Math.min(
			MAX_IDLE_MINUTES,
			Math.max(MIN_IDLE_MINUTES, Math.trunc(value))
		);
	}
	if (typeof value === "string" && value.trim()) {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) {
			return idleMinutesFromSetting(parsed);
		}
	}
	return DEFAULT_IDLE_MINUTES;
}

export function captureStatus(input: {
	gateCapturing?: boolean;
	hooksInstalled?: boolean;
	paused: boolean;
	sessionActive: boolean;
	workspaceConsented: boolean;
}): CaptureStatus {
	if (!input.workspaceConsented) {
		return "not_consented";
	}
	if (input.paused) {
		return "paused";
	}
	if (!input.sessionActive) {
		return "off";
	}
	if (input.hooksInstalled === false || input.gateCapturing === false) {
		return "misconfigured";
	}
	return "capturing";
}

export function shouldAutoStart(input: {
	paused: boolean;
	workspaceConsented: boolean;
}): boolean {
	return input.workspaceConsented && !input.paused;
}

export function shouldPromptConsent(workspaceConsented: boolean): boolean {
	return !workspaceConsented;
}

export type CaptureCommand =
	| "endTask"
	| "newTask"
	| "pause"
	| "resume"
	| "start"
	| "stop"
	| "toggle";

export interface CommandPlan {
	autoStart: boolean;
	needsConsentUi: boolean;
	paused: boolean;
	status: CaptureStatus;
}

export function planAfterCommand(
	input: {
		paused: boolean;
		workspaceConsented: boolean;
	},
	command: CaptureCommand
): CommandPlan {
	if (!input.workspaceConsented) {
		const needsConsentUi =
			command === "start" || command === "resume" || command === "toggle";
		return {
			autoStart: false,
			needsConsentUi,
			paused: false,
			status: "not_consented",
		};
	}
	let paused = input.paused;
	switch (command) {
		case "start":
		case "resume":
			paused = false;
			break;
		case "stop":
		case "pause":
			paused = true;
			break;
		case "toggle":
			paused = !paused;
			break;
		case "newTask":
		case "endTask":
			break;
		default: {
			const exhaustive: never = command;
			throw new Error(`Unhandled capture command: ${exhaustive}`);
		}
	}
	const autoStart = shouldAutoStart({
		paused,
		workspaceConsented: true,
	});
	return {
		autoStart,
		needsConsentUi: false,
		paused,
		status: captureStatus({
			paused,
			sessionActive: autoStart,
			workspaceConsented: true,
		}),
	};
}

export function statusBarLabel(status: CaptureStatus): {
	command:
		| "mati.capture.consent"
		| "mati.capture.diagnose"
		| "mati.capture.statusToggle";
	text: string;
	tooltip: string;
} {
	switch (status) {
		case "capturing":
			return {
				command: "mati.capture.statusToggle",
				text: "$(record) Mati",
				tooltip: "Mati is capturing. Click to pause.",
			};
		case "paused":
			return {
				command: "mati.capture.statusToggle",
				text: "$(debug-pause) Mati paused",
				tooltip: "Mati is paused in this workspace. Click to resume.",
			};
		case "misconfigured":
			return {
				command: "mati.capture.diagnose",
				text: "$(warning) Mati",
				tooltip:
					"This workspace consented, but hooks.json or the capture gate is not armed. Click to diagnose.",
			};
		case "not_consented":
			return {
				command: "mati.capture.consent",
				text: "$(circle-slash) Mati",
				tooltip: "Mati is off until you consent in this workspace.",
			};
		case "off":
			return {
				command: "mati.capture.consent",
				text: "$(circle-slash) Mati off",
				tooltip: "Mati is not capturing.",
			};
		default: {
			const exhaustive: never = status;
			throw new Error(`Unhandled capture status: ${exhaustive}`);
		}
	}
}
