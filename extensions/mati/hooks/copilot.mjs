#!/usr/bin/env node
import { enqueueHookLine } from "./enqueue.mjs";

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
		enqueueHookLine(line);
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
