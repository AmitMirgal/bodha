import {
	closeSync,
	mkdirSync,
	openSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { defaultMatiHome } from "./install-hooks";

export const HOLDER_STALE_MS = 120_000;

export interface CaptureHolder {
	id: string;
	updatedAt: number;
	workspaceHash?: string;
}

export interface CaptureGate {
	capturing: boolean;
	deviceId?: string;
	holders?: CaptureHolder[];
	workspaceHash?: string;
}

function waitMs(ms: number) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		// Short lock retry; tests do not contend.
	}
}

function parseHolders(value: unknown): CaptureHolder[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const holders: CaptureHolder[] = [];
	for (const entry of value) {
		if (!entry || typeof entry !== "object") {
			continue;
		}
		const record = entry as CaptureHolder;
		if (typeof record.id !== "string" || record.id.length === 0) {
			continue;
		}
		holders.push({
			id: record.id,
			updatedAt:
				typeof record.updatedAt === "number" &&
				Number.isFinite(record.updatedAt)
					? record.updatedAt
					: 0,
			workspaceHash:
				typeof record.workspaceHash === "string"
					? record.workspaceHash
					: undefined,
		});
	}
	return holders;
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
			holders: parseHolders(parsed.holders),
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

export function normalizeCaptureGate(
	gate: CaptureGate,
	now = Date.now()
): CaptureGate {
	const holders = parseHolders(gate.holders).filter(
		(holder) => now - holder.updatedAt < HOLDER_STALE_MS
	);
	return {
		capturing: holders.length > 0,
		deviceId: gate.deviceId,
		holders,
		workspaceHash: gate.workspaceHash,
	};
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

function withGateLock<T>(matiHome: string | undefined, fn: () => T): T {
	const dir = matiHome ?? defaultMatiHome();
	mkdirSync(dir, { recursive: true });
	const lockPath = path.join(dir, "capture-gate.lock");
	for (let attempt = 0; attempt < 20; attempt += 1) {
		try {
			const fd = openSync(lockPath, "wx");
			try {
				return fn();
			} finally {
				closeSync(fd);
				try {
					unlinkSync(lockPath);
				} catch {
					// Lock file already gone.
				}
			}
		} catch {
			waitMs(25);
		}
	}
	return fn();
}

export function updateCaptureGate(
	mutator: (gate: CaptureGate) => CaptureGate,
	options?: { matiHome?: string; now?: number }
): CaptureGate {
	return withGateLock(options?.matiHome, () => {
		const filePath = captureGatePath(options?.matiHome);
		const current = readCaptureGate(filePath) ?? {
			capturing: false,
			holders: [],
		};
		const next = normalizeCaptureGate(mutator(current), options?.now);
		writeCaptureGate(next, options);
		return next;
	});
}

export function claimCaptureHolder(
	holder: CaptureHolder,
	options?: { deviceId?: string; matiHome?: string; workspaceHash?: string }
): CaptureGate {
	return updateCaptureGate((gate) => {
		const rest = parseHolders(gate.holders).filter(
			(entry) => entry.id !== holder.id
		);
		return {
			capturing: true,
			deviceId: options?.deviceId ?? gate.deviceId,
			holders: [...rest, holder],
			workspaceHash: options?.workspaceHash ?? gate.workspaceHash,
		};
	}, options);
}

export function releaseCaptureHolder(
	holderId: string,
	options?: { matiHome?: string }
): CaptureGate {
	return updateCaptureGate(
		(gate) => ({
			capturing: gate.capturing,
			deviceId: gate.deviceId,
			holders: parseHolders(gate.holders).filter(
				(entry) => entry.id !== holderId
			),
			workspaceHash: gate.workspaceHash,
		}),
		options
	);
}

export function clearCaptureGate(options?: {
	deviceId?: string;
	matiHome?: string;
}): CaptureGate {
	return updateCaptureGate(
		(gate) => ({
			capturing: false,
			deviceId: options?.deviceId ?? gate.deviceId,
			holders: [],
			workspaceHash: gate.workspaceHash,
		}),
		options
	);
}

export function defaultMatiHomeFromEnv(
	env: NodeJS.ProcessEnv = process.env
): string {
	return env.MATI_HOME || path.join(homedir(), ".mati");
}
