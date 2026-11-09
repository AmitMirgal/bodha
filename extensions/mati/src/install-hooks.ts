import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const MATI_HOOK_MARKER = ".mati/hooks/cursor.mjs";
const HOOK_EVENTS = [
	"afterAgentResponse",
	"afterFileEdit",
	"beforeSubmitPrompt",
	"preCompact",
	"sessionEnd",
] as const;

export interface HooksFile {
	hooks: Record<string, Array<{ command: string }>>;
	version: number;
}

export function defaultHooksPath(): string {
	return (
		process.env.MATI_CURSOR_HOOKS_PATH ||
		path.join(homedir(), ".cursor", "hooks.json")
	);
}

export function defaultMatiHome(): string {
	return process.env.MATI_HOME || path.join(homedir(), ".mati");
}

function isMatiCommand(command: string): boolean {
	return command.includes(MATI_HOOK_MARKER);
}

export function mergeMatiHooks(
	existing: HooksFile | null,
	command: string
): HooksFile {
	const hooks: HooksFile["hooks"] = { ...(existing?.hooks ?? {}) };
	for (const event of HOOK_EVENTS) {
		const rest = (hooks[event] ?? []).filter(
			(entry) => !isMatiCommand(entry.command)
		);
		hooks[event] = [...rest, { command }];
	}
	return { version: 1, hooks };
}

export function removeMatiHooks(existing: HooksFile | null): HooksFile {
	const hooks: HooksFile["hooks"] = { ...(existing?.hooks ?? {}) };
	for (const event of Object.keys(hooks)) {
		hooks[event] = (hooks[event] ?? []).filter(
			(entry) => !isMatiCommand(entry.command)
		);
		if (hooks[event].length === 0) {
			delete hooks[event];
		}
	}
	return { version: existing?.version ?? 1, hooks };
}

function readHooks(filePath: string): HooksFile | null {
	try {
		const parsed = JSON.parse(readFileSync(filePath, "utf8")) as HooksFile;
		if (!parsed || typeof parsed !== "object") {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function installCursorHooks(options: {
	hookScriptSource: string;
	hooksPath?: string;
	matiHome?: string;
}): { hooksPath: string; command: string } {
	const matiHome = options.matiHome ?? defaultMatiHome();
	const hooksPath = options.hooksPath ?? defaultHooksPath();
	const hookDir = path.join(matiHome, "hooks");
	mkdirSync(hookDir, { recursive: true });
	mkdirSync(path.join(matiHome, "queue"), { recursive: true });
	const dest = path.join(hookDir, "cursor.mjs");
	copyFileSync(options.hookScriptSource, dest);
	const command = `node ${dest}`;
	mkdirSync(path.dirname(hooksPath), { recursive: true });
	const next = mergeMatiHooks(readHooks(hooksPath), command);
	writeFileSync(hooksPath, `${JSON.stringify(next, null, 2)}\n`);
	return { hooksPath, command };
}

export function uninstallCursorHooks(options?: {
	hooksPath?: string;
}): HooksFile {
	const hooksPath = options?.hooksPath ?? defaultHooksPath();
	const next = removeMatiHooks(readHooks(hooksPath));
	writeFileSync(hooksPath, `${JSON.stringify(next, null, 2)}\n`);
	return next;
}
