import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunWithDb } from "../lib/db/rls";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION = "11111111-1111-4111-8111-111111111111";
const EVIDENCE = "44444444-4444-4444-8444-444444444444";
const SENTINEL = "sk-test-sentinel";

const generate = vi.fn();

vi.mock("./index", () => ({
	mastra: {
		getAgentById: () => ({ generate }),
	},
}));

import { runReview, runTrainer } from "./run";

function mockRunWithDb(): RunWithDb {
	return async (_identity, fn) => {
		const db = {
			exerciseSnapshot: {
				findFirst: async () =>
					await Promise.resolve({
						exerciseId: "shelf",
						contentHash: "sha256:x",
						specMarkdown: "Read the snapshot. Do not paste a solution.",
						testsSource: "test('x', () => {})",
						meta: {},
						sessionId: SESSION,
						userId: USER,
					}),
			},
			evidenceEvent: {
				findMany: async () =>
					await Promise.resolve([
						{
							id: EVIDENCE,
							seq: 1n,
							kind: "prompt",
							source: "learner",
							observationType: "trainer_prompt",
							payload: { content: "help" },
							createdAt: new Date(),
						},
					]),
			},
			testRun: {
				findFirst: async () => await Promise.resolve(null),
			},
		};
		return await fn(db as never);
	};
}

function supportedConfig(provider = "openai") {
	return {
		source: "user" as const,
		provider,
		model: "gpt-4.1",
		capabilities: {
			tools: "supported" as const,
			structuredOutput: "unknown" as const,
			streaming: "supported" as const,
			usageReporting: "unknown" as const,
		},
	};
}

afterEach(() => {
	generate.mockReset();
});

describe("Mastra orchestration with a mock adapter", () => {
	it("runs the trainer tool loop without a real provider key", async () => {
		generate.mockResolvedValue({
			text: "I read the snapshot. I will not paste a solution.",
			toolResults: [{ toolName: "get-exercise-snapshot" }],
			steps: [{ toolResults: [{ toolName: "get-exercise-snapshot" }] }],
			usage: { inputTokens: 12, outputTokens: 8 },
		});
		const result = await runTrainer({
			runWithDb: mockRunWithDb(),
			userId: USER,
			sessionId: SESSION,
			role: "trainer",
			config: supportedConfig(),
			apiKey: SENTINEL,
			messages: [{ role: "user", content: "What does the snapshot ask?" }],
		});
		expect(result.tools).toContain("get-exercise-snapshot");
		expect(result.text).toMatch(/snapshot/i);
		expect(result.text).not.toContain(SENTINEL);
		expect(generate).toHaveBeenCalled();
	});

	it("runs the review tool loop and returns coaching JSON only", async () => {
		generate.mockResolvedValue({
			text: JSON.stringify({
				summary: "The learner asked for help after a snapshot read.",
				suggestions: [
					{
						title: "Ask about the recorded prompt",
						detail: "The prompt asked for a rewrite.",
						improvedExample: "Which test fails first?",
						whyItHelps: "It uses the recorded prompt.",
						citations: [
							{ evidenceId: EVIDENCE, kind: "prompt", note: "prompt" },
						],
						illustrative: true,
					},
				],
				insufficientEvidence: [],
			}),
			toolResults: [
				{ toolName: "get-exercise-snapshot" },
				{ toolName: "get-session-evidence" },
				{ toolName: "get-latest-test-run" },
			],
			steps: [
				{
					toolResults: [
						{ toolName: "get-exercise-snapshot" },
						{ toolName: "get-session-evidence" },
						{ toolName: "get-latest-test-run" },
					],
				},
			],
			usage: { inputTokens: 30, outputTokens: 12 },
		});
		const result = await runReview({
			runWithDb: mockRunWithDb(),
			userId: USER,
			sessionId: SESSION,
			role: "review",
			config: supportedConfig(),
			apiKey: SENTINEL,
			messages: [
				{
					role: "user",
					content:
						"Retrieve snapshot, evidence, and latest test run, then return JSON.",
				},
			],
		});
		expect(result.tools).toEqual(
			expect.arrayContaining([
				"get-exercise-snapshot",
				"get-session-evidence",
				"get-latest-test-run",
			])
		);
		expect(result.model.summary).toMatch(/snapshot/i);
		expect(JSON.stringify(result.model)).not.toMatch(/\d+\s+tokens/);
	});

	it("does not send a base URL into the mock adapter", async () => {
		generate.mockResolvedValue({
			text: "I read the snapshot.",
			toolResults: [{ toolName: "get-exercise-snapshot" }],
			steps: [{ toolResults: [{ toolName: "get-exercise-snapshot" }] }],
		});
		await runTrainer({
			runWithDb: mockRunWithDb(),
			userId: USER,
			sessionId: SESSION,
			role: "trainer",
			config: supportedConfig(),
			apiKey: SENTINEL,
			messages: [{ role: "user", content: "hello" }],
		});
		const call = generate.mock.calls[0]?.[1] as
			| { requestContext?: { get: (key: string) => unknown } }
			| undefined;
		expect(JSON.stringify(call ?? {})).not.toMatch(/baseUrl|base_url/);
	});
});
