import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { defaultMatiHome } from "./install-hooks";

export interface CaptureGate {
	capturing: boolean;
	deviceId?: string;
	workspaceHash?: string;
}

export function captureGatePath(matiHome?: string): string {
	return path.join(matiHome ?? defaultMatiHome(), "capture-gate.json");
}

export function readCaptureGate(filePath: string): CaptureGate | null {
	try {
		const parsed = JSON.parse(readFileSync(filePath, "utf8")) as CaptureGate;
		if (!parsed || typeof parsed !== "object") {
			return null;
		}
		return {
			capturing: parsed.capturing === true,
			deviceId:
				typeof parsed.deviceId === "string" ? parsed.deviceId : undefined,
			workspaceHash:
				typeof parsed.workspaceHash === "string"
					? parsed.workspaceHash
					: undefined,
		};
	} catch {
		return null;
	}
}

export function shouldEnqueueFromGate(gate: CaptureGate | null): boolean {
	return gate?.capturing === true;
}

export function writeCaptureGate(
	gate: CaptureGate,
	options?: { matiHome?: string }
): string {
	const filePath = captureGatePath(options?.matiHome);
	mkdirSync(path.dirname(filePath), { recursive: true });
	writeFileSync(filePath, `${JSON.stringify(gate, null, 2)}\n`);
	return filePath;
}

export function defaultMatiHomeFromEnv(
	env: NodeJS.ProcessEnv = process.env
): string {
	return env.MATI_HOME || path.join(homedir(), ".mati");
}
