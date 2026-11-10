import { describe, expect, it } from "vitest";
import { nodeBinaryCandidates, resolveNodeBinary } from "./node-binary";

describe("node binary resolution", () => {
	it("prefers a real node execPath and homebrew candidates", () => {
		const candidates = nodeBinaryCandidates(
			"/Users/amit",
			"/usr/bin:/opt/homebrew/bin",
			"/usr/local/bin/node"
		);
		expect(candidates[0]).toBe("/usr/local/bin/node");
		expect(candidates).toContain("/opt/homebrew/bin/node");
	});

	it("resolves the current process node in tests", () => {
		expect(resolveNodeBinary()).toBe(process.execPath);
	});
});
