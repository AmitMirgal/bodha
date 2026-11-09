import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ingestBodyFromCopilot, mapCopilotHook } from "./map-copilot";
import { ingestBodyFromCursor, mapCursorHook } from "./map-cursor";
import { ingestBodyFromOtel, parseCopilotOtelLine } from "./otel";

const PATH_SEP = /[/\\]/;

interface DrainOptions {
	fetchImpl?: typeof fetch;
	origin: string;
	queuePath: string;
	secret: string;
	workspaceHash: string;
}

async function postBatch(
	options: DrainOptions,
	body: unknown
): Promise<boolean> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const response = await fetchImpl(`${options.origin}/api/capture/v1/events`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${options.secret}`,
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	});
	return response.ok;
}

function ingestBodyFromQueueLine(
	raw: unknown,
	workspaceHash: string
): unknown | null {
	const cursor = mapCursorHook(raw);
	if (cursor) {
		return ingestBodyFromCursor(cursor, workspaceHash);
	}
	const copilot = mapCopilotHook(raw);
	if (copilot) {
		return ingestBodyFromCopilot(copilot, workspaceHash);
	}
	return null;
}

export async function drainQueueFile(
	options: DrainOptions
): Promise<{ failed: number; posted: number }> {
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
		const body = ingestBodyFromQueueLine(raw, options.workspaceHash);
		if (!body) {
			continue;
		}
		if (await postBatch(options, body)) {
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

export async function drainOtelFile(options: {
	fetchImpl?: typeof fetch;
	origin: string;
	otelPath: string;
	secret: string;
	workspaceHash: string;
}): Promise<{ failed: number; posted: number }> {
	let posted = 0;
	let failed = 0;
	let text = "";
	try {
		text = readFileSync(options.otelPath, "utf8");
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
		const spans = parseCopilotOtelLine(raw);
		if (spans.length === 0) {
			continue;
		}
		let allOk = true;
		for (const span of spans) {
			const ok = await postBatch(
				{
					fetchImpl: options.fetchImpl,
					origin: options.origin,
					queuePath: options.otelPath,
					secret: options.secret,
					workspaceHash: options.workspaceHash,
				},
				ingestBodyFromOtel(span, options.workspaceHash)
			);
			if (!ok) {
				allOk = false;
			}
		}
		if (allOk) {
			posted += 1;
		} else {
			leftover.push(line);
			failed += 1;
		}
	}
	mkdirSync(path.dirname(options.otelPath), { recursive: true });
	writeFileSync(
		options.otelPath,
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
