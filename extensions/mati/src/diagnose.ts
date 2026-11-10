import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
	type CaptureGate,
	captureGatePath,
	readCaptureGate,
} from "./capture-gate";
import {
	defaultCopilotHooksPath,
	defaultCursorHookDir,
	defaultCursorWrapperPath,
	defaultHooksPath,
	defaultMatiHome,
	hooksFileHasMati,
	readHooksFile,
} from "./install-hooks";

export interface LastUploadStatus {
	at: string;
	error?: string;
	failed: number;
	ok: boolean;
	origin: string;
	posted: number;
}

export interface CaptureDiagnosis {
	copilotHooksPath: string;
	copilotHooksPresent: boolean;
	cursorHookScriptPresent: boolean;
	cursorHooksHasMati: boolean;
	cursorHooksPath: string;
	deviceRegistered: boolean;
	enqueueScriptPresent: boolean;
	gate: CaptureGate | null;
	gatePath: string;
	lastUpload: LastUploadStatus | null;
	queueCount: number;
	queuePath: string;
	serverUrl: string;
	workspaceHash: string;
	wrapperPresent: boolean;
}

export function lastUploadPath(matiHome = defaultMatiHome()): string {
	return path.join(matiHome, "last-upload.json");
}

export function readLastUpload(
	matiHome = defaultMatiHome()
): LastUploadStatus | null {
	try {
		const parsed = JSON.parse(
			readFileSync(lastUploadPath(matiHome), "utf8")
		) as LastUploadStatus;
		if (!parsed || typeof parsed !== "object") {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function writeLastUpload(
	status: LastUploadStatus,
	matiHome = defaultMatiHome()
): string {
	const filePath = lastUploadPath(matiHome);
	mkdirSync(path.dirname(filePath), { recursive: true });
	writeFileSync(filePath, `${JSON.stringify(status, null, 2)}\n`);
	return filePath;
}

export function countQueueLines(queuePath: string): number {
	try {
		return readFileSync(queuePath, "utf8")
			.split("\n")
			.filter((line) => line.trim().length > 0).length;
	} catch {
		return 0;
	}
}

export function collectCaptureDiagnosis(input: {
	deviceId?: string;
	matiHome?: string;
	serverUrl: string;
	workspaceHash: string;
}): CaptureDiagnosis {
	const matiHome = input.matiHome ?? defaultMatiHome();
	const cursorHooksPath = defaultHooksPath();
	const { existing } = readHooksFile(cursorHooksPath);
	const cursorHookDir = defaultCursorHookDir(cursorHooksPath);
	const queuePath = path.join(
		matiHome,
		"queue",
		`${input.deviceId ?? "pending"}.jsonl`
	);
	const copilotHooksPath = defaultCopilotHooksPath();
	return {
		copilotHooksPath,
		copilotHooksPresent: existsSync(copilotHooksPath),
		cursorHookScriptPresent: existsSync(path.join(cursorHookDir, "cursor.mjs")),
		cursorHooksHasMati: hooksFileHasMati(existing),
		cursorHooksPath,
		deviceRegistered: Boolean(input.deviceId),
		enqueueScriptPresent: existsSync(path.join(cursorHookDir, "enqueue.mjs")),
		gate: readCaptureGate(captureGatePath(matiHome)),
		gatePath: captureGatePath(matiHome),
		lastUpload: readLastUpload(matiHome),
		queueCount: countQueueLines(queuePath),
		queuePath,
		serverUrl: input.serverUrl,
		wrapperPresent: existsSync(defaultCursorWrapperPath(cursorHooksPath)),
		workspaceHash: input.workspaceHash,
	};
}

export function formatDiagnosis(diagnosis: CaptureDiagnosis): string {
	const holders = diagnosis.gate?.holders?.length ?? 0;
	const last = diagnosis.lastUpload;
	const lastLine = last
		? `${last.ok ? "ok" : "failed"} posted=${last.posted} failed=${last.failed} at ${last.at} origin=${last.origin}`
		: "none";
	return [
		`Server URL: ${diagnosis.serverUrl}`,
		`Device registered: ${diagnosis.deviceRegistered ? "yes" : "no"}`,
		`Gate: capturing=${diagnosis.gate?.capturing === true} holders=${holders} path=${diagnosis.gatePath}`,
		`Cursor hooks.json: hasMati=${diagnosis.cursorHooksHasMati} path=${diagnosis.cursorHooksPath}`,
		`Hook scripts: wrapper=${diagnosis.wrapperPresent} cursor.mjs=${diagnosis.cursorHookScriptPresent} enqueue.mjs=${diagnosis.enqueueScriptPresent}`,
		`Copilot hooks: present=${diagnosis.copilotHooksPresent} path=${diagnosis.copilotHooksPath}`,
		`Queue: ${diagnosis.queueCount} line(s) at ${diagnosis.queuePath}`,
		`Last upload: ${lastLine}`,
		`Workspace hash: ${diagnosis.workspaceHash}`,
	].join("\n");
}
