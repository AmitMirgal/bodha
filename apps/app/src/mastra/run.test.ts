import { describe, expect, it } from "vitest";
import { MissingToolUseError } from "./run";

describe("orchestration contract", () => {
	it("exposes a missing-tool error that a one-shot wrapper must hit", () => {
		const error = new MissingToolUseError(
			"Trainer did not use required tools.",
		);
		expect(error.name).toBe("MissingToolUseError");
	});
});
