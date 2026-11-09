import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ingestBodyFromCursor, mapCursorHook } from "./map-cursor";

const PATH_SEP = /[/\\]/;

export async function drainQueueFile(options: {
	queuePath: string;
	origin: string;
	secret: string;
	workspaceHash: string;
	fetchImpl?: typeof fetch;
}): Promise<{ posted: number; failed: number }> {
	const fetchImpl = options.fetchImpl ?? fetch;
	let posted = 0;
	let failed = 0;
	let text = "";
	try {
		text = readFileSync(options.queuePath, "utf8");
	} catch {
		return { posted: 0, failed: 0 };
	}
	const lines = text.split("\n").filter((line) => line.trim().length > 0);
	const leftover: string[] = [];
	for (const line of lines) {
		let raw: unknown;
		try {
			raw = JSON.parse(line);
		} catch {
			leftover.push(line);
			failed += 1;
			continue;
		}
		const mapped = mapCursorHook(raw);
		if (!mapped) {
			continue;
		}
		const body = ingestBodyFromCursor(mapped, options.workspaceHash);
		const response = await fetchImpl(
			`${options.origin}/api/capture/v1/events`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${options.secret}`,
					"content-type": "application/json",
				},
				body: JSON.stringify(body),
			}
		);
		if (response.ok) {
			posted += 1;
		} else {
			leftover.push(line);
			failed += 1;
		}
	}
	mkdirSync(path.dirname(options.queuePath), { recursive: true });
	writeFileSync(
		options.queuePath,
		leftover.length > 0 ? `${leftover.join("\n")}\n` : ""
	);
	return { posted, failed };
}

export function workspaceHashFromFolders(folders: string[]): string {
	const names = folders
		.map((folder) => folder.split(PATH_SEP).at(-1) || folder)
		.sort()
		.join("|");
	return createHash("sha256")
		.update(names || "no-workspace")
		.digest("hex");
}
