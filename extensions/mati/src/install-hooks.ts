import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { resolveNodeBinary } from "./node-binary";

const MATI_HOOK_MARKERS = [
	".mati/hooks/cursor.mjs",
	"hooks/mati-capture.sh",
	"hooks/mati/cursor.mjs",
];
const HOOK_EVENTS = [
	"afterAgentResponse",
	"afterFileEdit",
	"beforeSubmitPrompt",
	"preCompact",
	"sessionEnd",
	"stop",
] as const;
const HOOK_SCRIPT_FILES = ["copilot.mjs", "cursor.mjs", "enqueue.mjs"] as const;

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

export function defaultCursorHookDir(hooksPath = defaultHooksPath()): string {
	return path.join(path.dirname(hooksPath), "hooks", "mati");
}

export function defaultCursorWrapperPath(
	hooksPath = defaultHooksPath()
): string {
	return path.join(path.dirname(hooksPath), "hooks", "mati-capture.sh");
}

function isMatiCommand(command: string): boolean {
	return MATI_HOOK_MARKERS.some((marker) => command.includes(marker));
}

export function hooksFileHasMati(existing: HooksFile | null): boolean {
	if (!existing) {
		return false;
	}
	return Object.values(existing.hooks).some((entries) =>
		entries.some((entry) => isMatiCommand(entry.command))
	);
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
	return { hooks, version: 1 };
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
	return { hooks, version: existing?.version ?? 1 };
}

export function readHooksFile(filePath: string): {
	existing: HooksFile | null;
	invalidBackupPath?: string;
	warning?: string;
} {
	try {
		const raw = readFileSync(filePath, "utf8");
		const parsed = JSON.parse(raw) as HooksFile;
		if (!parsed || typeof parsed !== "object") {
			return { existing: null };
		}
		return { existing: parsed };
	} catch (error) {
		const code =
			error && typeof error === "object" && "code" in error
				? (error as { code?: string }).code
				: undefined;
		if (code === "ENOENT") {
			return { existing: null };
		}
		if (error instanceof SyntaxError) {
			const invalidBackupPath = `${filePath}.mati-invalid`;
			try {
				copyFileSync(filePath, invalidBackupPath);
			} catch {
				// Best effort backup.
			}
			return {
				existing: null,
				invalidBackupPath,
				warning: `Existing ${filePath} was not valid JSON. Copied to ${invalidBackupPath} and wrote a new file.`,
			};
		}
		throw error;
	}
}

function writeHooksAtomic(filePath: string, next: HooksFile) {
	mkdirSync(path.dirname(filePath), { recursive: true });
	const tmpPath = `${filePath}.tmp`;
	writeFileSync(tmpPath, `${JSON.stringify(next, null, 2)}\n`);
	renameSync(tmpPath, filePath);
}

function copyHookScripts(sourceDir: string, destDir: string) {
	mkdirSync(destDir, { recursive: true });
	for (const name of HOOK_SCRIPT_FILES) {
		const from = path.join(sourceDir, name);
		if (!existsSync(from)) {
			continue;
		}
		copyFileSync(from, path.join(destDir, name));
	}
}

export function matiCaptureWrapperSource(
	nodePath: string,
	scriptPath: string
): string {
	return `#!/bin/sh
exec "${nodePath}" "${scriptPath}"
`;
}

function writeCursorWrapper(options: {
	hooksPath: string;
	nodePath: string;
	scriptPath: string;
}): string {
	const wrapperPath = defaultCursorWrapperPath(options.hooksPath);
	mkdirSync(path.dirname(wrapperPath), { recursive: true });
	writeFileSync(
		wrapperPath,
		matiCaptureWrapperSource(options.nodePath, options.scriptPath)
	);
	chmodSync(wrapperPath, 0o755);
	return wrapperPath;
}

function requireNodeBinary(): string {
	const nodePath = resolveNodeBinary();
	if (!nodePath) {
		throw new Error(
			"Mati could not find a Node.js binary to run Cursor hooks. Install Node (Homebrew, nvm, or /usr/local/bin/node) and run Mati: Start capturing again."
		);
	}
	return nodePath;
}

function verifyMatiHooks(hooksPath: string, command: string) {
	const { existing } = readHooksFile(hooksPath);
	if (!hooksFileHasMati(existing)) {
		throw new Error(
			`Mati could not write its hook into ${hooksPath}. Expected command ${command}. Capture will not see Agent prompts until this file contains the Mati block.`
		);
	}
}

export function installCursorHooks(options: {
	hookScriptSource: string;
	hooksPath?: string;
	matiHome?: string;
}): { command: string; hooksPath: string; warning?: string } {
	const matiHome = options.matiHome ?? defaultMatiHome();
	const hooksPath = options.hooksPath ?? defaultHooksPath();
	const sourceDir = path.dirname(options.hookScriptSource);
	copyHookScripts(sourceDir, path.join(matiHome, "hooks"));
	mkdirSync(path.join(matiHome, "queue"), { recursive: true });
	const cursorHookDir = defaultCursorHookDir(hooksPath);
	copyHookScripts(sourceDir, cursorHookDir);
	const scriptPath = path.join(cursorHookDir, "cursor.mjs");
	if (
		!(
			existsSync(scriptPath) &&
			existsSync(path.join(cursorHookDir, "enqueue.mjs"))
		)
	) {
		throw new Error(
			`Mati could not copy hook scripts into ${cursorHookDir} (need cursor.mjs and enqueue.mjs).`
		);
	}
	const nodePath = requireNodeBinary();
	writeCursorWrapper({ hooksPath, nodePath, scriptPath });
	const command = "./hooks/mati-capture.sh";
	const { existing, warning } = readHooksFile(hooksPath);
	const next = mergeMatiHooks(existing, command);
	writeHooksAtomic(hooksPath, next);
	verifyMatiHooks(hooksPath, command);
	return { command, hooksPath, warning };
}

export function ensureCursorHooks(options: {
	hookScriptSource: string;
	hooksPath?: string;
	matiHome?: string;
}): {
	command: string;
	hooksPath: string;
	repaired: boolean;
	warning?: string;
} {
	const hooksPath = options.hooksPath ?? defaultHooksPath();
	const { existing } = readHooksFile(hooksPath);
	const wrapperPath = defaultCursorWrapperPath(hooksPath);
	const scriptPath = path.join(defaultCursorHookDir(hooksPath), "cursor.mjs");
	const enqueuePath = path.join(defaultCursorHookDir(hooksPath), "enqueue.mjs");
	if (
		hooksFileHasMati(existing) &&
		existsSync(wrapperPath) &&
		existsSync(scriptPath) &&
		existsSync(enqueuePath)
	) {
		return {
			command: "./hooks/mati-capture.sh",
			hooksPath,
			repaired: false,
		};
	}
	const installed = installCursorHooks(options);
	return { ...installed, repaired: true };
}

export function uninstallCursorHooks(options?: {
	hooksPath?: string;
}): HooksFile {
	const hooksPath = options?.hooksPath ?? defaultHooksPath();
	const { existing } = readHooksFile(hooksPath);
	const next = removeMatiHooks(existing);
	writeHooksAtomic(hooksPath, next);
	try {
		rmSync(defaultCursorHookDir(hooksPath), { recursive: true, force: true });
	} catch {
		// Already gone.
	}
	try {
		rmSync(defaultCursorWrapperPath(hooksPath), { force: true });
	} catch {
		// Already gone.
	}
	return next;
}

const COPILOT_HOOK_EVENTS = [
	"UserPromptSubmit",
	"userPromptSubmitted",
	"PostToolUse",
	"postToolUse",
	"PreCompact",
	"preCompact",
	"SessionEnd",
	"sessionEnd",
	"Stop",
	"agentStop",
] as const;

export interface CopilotHooksFile {
	hooks: Record<string, Array<{ bash: string; type: "command" }>>;
	version: number;
}

export function defaultCopilotHooksPath(): string {
	return (
		process.env.MATI_COPILOT_HOOKS_PATH ||
		path.join(homedir(), ".copilot", "hooks", "mati.json")
	);
}

export function installCopilotHooks(options: {
	hookScriptSource: string;
	hooksPath?: string;
	matiHome?: string;
}): { command: string; hooksPath: string } {
	const matiHome = options.matiHome ?? defaultMatiHome();
	const hooksPath = options.hooksPath ?? defaultCopilotHooksPath();
	const sourceDir = path.dirname(options.hookScriptSource);
	copyHookScripts(sourceDir, path.join(matiHome, "hooks"));
	mkdirSync(path.join(matiHome, "queue"), { recursive: true });
	const dest = path.join(matiHome, "hooks", "copilot.mjs");
	const command = `node ${dest}`;
	const hooks: CopilotHooksFile["hooks"] = {};
	for (const event of COPILOT_HOOK_EVENTS) {
		hooks[event] = [{ bash: command, type: "command" }];
	}
	mkdirSync(path.dirname(hooksPath), { recursive: true });
	writeFileSync(
		hooksPath,
		`${JSON.stringify({ hooks, version: 1 }, null, 2)}\n`
	);
	return { command, hooksPath };
}

export function uninstallCopilotHooks(options?: { hooksPath?: string }): void {
	const hooksPath = options?.hooksPath ?? defaultCopilotHooksPath();
	try {
		rmSync(hooksPath);
	} catch {
		// Already gone.
	}
}
