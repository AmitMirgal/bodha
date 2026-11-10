import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

function isNodeName(filePath: string): boolean {
	const name = path.basename(filePath).toLowerCase();
	return name === "node" || name === "node.exe";
}

function nvmNodeBinaries(home: string): string[] {
	const root = path.join(home, ".nvm", "versions", "node");
	try {
		return readdirSync(root)
			.map((version) => path.join(root, version, "bin", "node"))
			.sort();
	} catch {
		return [];
	}
}

export function nodeBinaryCandidates(
	home: string,
	pathEnv: string,
	execPath?: string
): string[] {
	const fromPath = pathEnv
		.split(path.delimiter)
		.filter(Boolean)
		.map((dir) =>
			path.join(dir, process.platform === "win32" ? "node.exe" : "node")
		);
	const extras = [
		"/opt/homebrew/bin/node",
		"/usr/local/bin/node",
		path.join(home, ".local", "bin", "node"),
		path.join(home, ".volta", "bin", "node"),
		path.join(home, ".asdf", "shims", "node"),
		path.join(home, ".fnm", "current", "bin", "node"),
		...nvmNodeBinaries(home),
	];
	const exec = execPath && isNodeName(execPath) ? [execPath] : [];
	return [...exec, ...fromPath, ...extras];
}

export function resolveNodeBinary(
	env: NodeJS.ProcessEnv = process.env,
	home = homedir(),
	execPath = process.execPath
): string | null {
	for (const candidate of nodeBinaryCandidates(
		home,
		env.PATH ?? "",
		execPath
	)) {
		try {
			if (existsSync(candidate) && statSync(candidate).isFile()) {
				return candidate;
			}
		} catch {
			// Skip unreadable candidates.
		}
	}
	return null;
}
