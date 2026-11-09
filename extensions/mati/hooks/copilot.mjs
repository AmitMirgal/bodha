#!/usr/bin/env node
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

function reply() {
	process.stdout.write("{}\n");
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
	raw += chunk;
});
process.stdin.on("end", () => {
	try {
		const queueDir =
			process.env.MATI_QUEUE_DIR || path.join(homedir(), ".mati", "queue");
		const deviceId = process.env.MATI_DEVICE_ID || "pending";
		mkdirSync(queueDir, { recursive: true });
		let line = raw.trim() || "{}";
		try {
			const parsed = JSON.parse(line);
			if (parsed && typeof parsed === "object") {
				parsed.user_email = undefined;
				parsed.userEmail = undefined;
				line = JSON.stringify(parsed);
			}
		} catch {
			// Keep the raw line. Mapping happens in the extension host.
		}
		appendFileSync(path.join(queueDir, `${deviceId}.jsonl`), `${line}\n`);
	} catch {
		// Observation only. Never block the agent.
	}
	reply();
	process.exit(0);
});
process.stdin.on("error", () => {
	reply();
	process.exit(0);
});
