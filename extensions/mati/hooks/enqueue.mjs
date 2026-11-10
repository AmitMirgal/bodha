import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export function shouldEnqueue(gate) {
	return Boolean(gate && gate.capturing === true);
}

export function readGate(matiHome) {
	try {
		const parsed = JSON.parse(
			readFileSync(path.join(matiHome, "capture-gate.json"), "utf8")
		);
		if (!parsed || typeof parsed !== "object") {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function enqueueHookLine(line, env = process.env) {
	const matiHome = env.MATI_HOME || path.join(homedir(), ".mati");
	const gate = readGate(matiHome);
	if (!shouldEnqueue(gate)) {
		return false;
	}
	const queueDir = env.MATI_QUEUE_DIR || path.join(matiHome, "queue");
	const deviceId =
		(gate && typeof gate.deviceId === "string" && gate.deviceId) ||
		env.MATI_DEVICE_ID ||
		"pending";
	mkdirSync(queueDir, { recursive: true });
	appendFileSync(path.join(queueDir, `${deviceId}.jsonl`), `${line}\n`);
	return true;
}
