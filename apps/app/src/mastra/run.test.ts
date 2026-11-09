import {
	assertAgentToolsAllowed,
	DEFAULT_CAPABILITIES,
	ToolsUnsupportedError,
} from "@repo/ai/provider";
import { describe, expect, it } from "vitest";
import {
	AgentBudgetError,
	assertRequiredTools,
	generateWithBudget,
	MissingToolUseError,
} from "./run";

describe("orchestration contract", () => {
	it("fails closed on a one-shot response with no tools", () => {
		expect(() =>
			assertRequiredTools(
				{ toolResults: [], steps: [{ toolResults: [] }] },
				["get-exercise-snapshot"],
				"Trainer"
			)
		).toThrow(MissingToolUseError);
	});

	it("requires the named multi-step evidence tools, not merely a count", () => {
		expect(() =>
			assertRequiredTools(
				{
					steps: [
						{ toolResults: [{ toolName: "get-exercise-snapshot" }] },
						{ toolResults: [{ toolName: "unrelated-tool" }] },
					],
				},
				[
					"get-exercise-snapshot",
					"get-session-evidence",
					"get-latest-test-run",
				],
				"Review"
			)
		).toThrow(/get-session-evidence/);

		const names = assertRequiredTools(
			{
				steps: [
					{ toolResults: [{ toolName: "get-exercise-snapshot" }] },
					{ toolResults: [{ toolName: "get-session-evidence" }] },
					{ toolResults: [{ toolName: "get-latest-test-run" }] },
				],
			},
			["get-exercise-snapshot", "get-session-evidence", "get-latest-test-run"],
			"Review"
		);
		expect(names).toEqual([
			"get-exercise-snapshot",
			"get-session-evidence",
			"get-latest-test-run",
		]);
	});

	it("aborts the in-flight run when the budget elapses", async () => {
		let aborted = false;
		await expect(
			generateWithBudget(
				async (signal) => {
					await new Promise<void>((resolve, reject) => {
						const timer = setTimeout(resolve, 200);
						signal.addEventListener("abort", () => {
							aborted = true;
							clearTimeout(timer);
							reject(new DOMException("Aborted", "AbortError"));
						});
					});
					return "too-late";
				},
				20,
				"Trainer"
			)
		).rejects.toBeInstanceOf(AgentBudgetError);
		expect(aborted).toBe(true);
	});

	it("does not silently one-shot when tools are unsupported or unproven", () => {
		expect(() =>
			assertAgentToolsAllowed({
				source: "user",
				provider: "openai",
				model: "gpt-4.1",
				capabilities: { ...DEFAULT_CAPABILITIES, tools: "unsupported" },
			})
		).toThrow(ToolsUnsupportedError);
		expect(() =>
			assertAgentToolsAllowed({
				source: "user",
				provider: "openai",
				model: "gpt-4.1",
				capabilities: DEFAULT_CAPABILITIES,
			})
		).toThrow(ToolsUnsupportedError);
	});
});
