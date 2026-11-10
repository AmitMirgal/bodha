import { execFileSync } from "node:child_process";

export type RunGit = (
	file: string,
	args: string[],
	options: { cwd: string; encoding: "utf8"; timeout: number }
) => string;

export function readGitBranch(
	cwd: string | undefined,
	run: RunGit = execFileSync
): string | null {
	if (!cwd) {
		return null;
	}
	try {
		const raw = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
			cwd,
			encoding: "utf8",
			timeout: 2000,
		});
		const branch = raw.trim();
		return branch.length > 0 ? branch : null;
	} catch {
		return null;
	}
}
