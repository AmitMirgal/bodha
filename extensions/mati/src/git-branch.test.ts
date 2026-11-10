import { describe, expect, it } from "vitest";
import { readGitBranch } from "./git-branch";

describe("readGitBranch", () => {
	it("returns the current branch name", () => {
		const branch = readGitBranch("/repo", () => "feat/capture\n");
		expect(branch).toBe("feat/capture");
	});

	it("returns null without a workspace or when git fails", () => {
		expect(readGitBranch(undefined)).toBeNull();
		expect(
			readGitBranch("/repo", () => {
				throw new Error("not a git repo");
			})
		).toBeNull();
	});
});
