import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { runReview, runTrainer } from "./run";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION = "11111111-1111-4111-8111-111111111111";
const EVIDENCE = "44444444-4444-4444-8444-444444444444";
const SENTINEL = "sk-test-sentinel";

function hasToolResult(messages: unknown[]): boolean {
	return messages.some((message) => {
		if (!message || typeof message !== "object") {
			return false;
		}
		const row = message as { content?: unknown; role?: string };
		if (row.role === "tool") {
			return true;
		}
		if (!Array.isArray(row.content)) {
			return false;
		}
		return row.content.some((part) => {
			if (!part || typeof part !== "object") {
				return false;
			}
			const type = (part as { type?: string }).type;
			return (
				type === "tool-result" ||
				type === "tool_result" ||
				type === "function_call_output"
			);
		});
	});
}

function mockSupabase() {
	function chain(table: string) {
		const self = {
			select() {
				return self;
			},
			eq() {
				return self;
			},
			in() {
				return self;
			},
			order() {
				return self;
			},
			limit() {
				return self;
			},
			maybeSingle: async () => {
				if (table === "exercise_snapshots") {
					return {
						data: {
							exercise_id: "shelf",
							content_hash: "sha256:x",
							spec_markdown: "Read the snapshot. Do not paste a solution.",
							tests_source: "test('x', () => {})",
							meta: {},
							session_id: SESSION,
							user_id: USER,
						},
						error: null,
					};
				}
				if (table === "test_runs") {
					return { data: null, error: null };
				}
				return { data: null, error: null };
			},
			// biome-ignore lint/suspicious/noThenProperty: supabase query mock is thenable
			then(
				resolve: (value: { data: unknown; error: null }) => unknown,
				reject?: (reason: unknown) => unknown,
			) {
				const data =
					table === "evidence_events"
						? [
								{
									id: EVIDENCE,
									seq: 1,
									kind: "prompt",
									source: "learner",
									observation_type: "trainer_prompt",
									payload: { content: "help" },
									created_at: new Date().toISOString(),
									session_id: SESSION,
									user_id: USER,
								},
							]
						: [];
				return Promise.resolve({ data, error: null }).then(resolve, reject);
			},
		};
		return self;
	}
	return {
		from(table: string) {
			return chain(table);
		},
	};
}

function startFixture(mode: "trainer" | "review" | "redirect") {
	const requests: { body: unknown; url: string }[] = [];
	const server = http.createServer((req, res) => {
		if (mode === "redirect") {
			res.writeHead(302, { location: "http://127.0.0.1/secret" });
			res.end();
			return;
		}
		if (
			req.method === "POST" &&
			(req.url ?? "").endsWith("/chat/completions")
		) {
			const chunks: Buffer[] = [];
			req.on("data", (chunk) => {
				chunks.push(chunk as Buffer);
			});
			req.on("end", () => {
				const raw = Buffer.concat(chunks).toString("utf8");
				expect(raw).not.toContain(SENTINEL);
				const body = JSON.parse(raw) as {
					messages?: unknown[];
					tools?: { function?: { name?: string }; name?: string }[];
				};
				requests.push({ body, url: req.url ?? "" });
				const messages = Array.isArray(body.messages) ? body.messages : [];
				const requestedTools = (body.tools ?? [])
					.map((tool) => tool.function?.name ?? tool.name)
					.filter((name): name is string => Boolean(name));
				const secondTurn = hasToolResult(messages) || requests.length > 1;
				const payload = secondTurn
					? mode === "review"
						? {
								id: "cmpl-review",
								object: "chat.completion",
								choices: [
									{
										index: 0,
										finish_reason: "stop",
										message: {
											role: "assistant",
											content: JSON.stringify({
												summary:
													"The learner asked for help after a snapshot read.",
												suggestions: [
													{
														title: "Ask about the recorded prompt",
														detail: "The prompt asked for a rewrite.",
														improvedExample: "Which test fails first?",
														whyItHelps: "It uses the recorded prompt.",
														citations: [
															{
																evidenceId: EVIDENCE,
																kind: "prompt",
																note: "prompt",
															},
														],
														illustrative: true,
													},
												],
												insufficientEvidence: [],
											}),
										},
									},
								],
								usage: {
									prompt_tokens: 30,
									completion_tokens: 12,
									total_tokens: 42,
								},
							}
						: {
								id: "cmpl-2",
								object: "chat.completion",
								choices: [
									{
										index: 0,
										finish_reason: "stop",
										message: {
											role: "assistant",
											content:
												"I read the snapshot. I will not paste a solution.",
										},
									},
								],
								usage: {
									prompt_tokens: 24,
									completion_tokens: 9,
									total_tokens: 33,
								},
							}
					: {
							id: "cmpl-1",
							object: "chat.completion",
							choices: [
								{
									index: 0,
									finish_reason: "tool_calls",
									message: {
										role: "assistant",
										content: null,
										tool_calls: (requestedTools.length > 0
											? requestedTools
											: mode === "review"
												? [
														"get-exercise-snapshot",
														"get-session-evidence",
														"get-latest-test-run",
													]
												: ["get-exercise-snapshot"]
										).map((name, index) => ({
											id: `call_${index}`,
											type: "function",
											function: { name, arguments: "{}" },
										})),
									},
								},
							],
							usage: {
								prompt_tokens: 12,
								completion_tokens: 8,
								total_tokens: 20,
							},
						};
				res.writeHead(200, { "content-type": "application/json" });
				res.end(JSON.stringify(payload));
			});
			return;
		}
		res.writeHead(404);
		res.end();
	});
	return new Promise<{
		href: string;
		requests: { body: unknown; url: string }[];
		server: http.Server;
	}>((resolve) => {
		server.listen(0, "127.0.0.1", () => {
			const addr = server.address() as AddressInfo;
			resolve({
				server,
				href: `http://127.0.0.1:${addr.port}/v1`,
				requests,
			});
		});
	});
}

function supportedConfig(baseUrl: string) {
	return {
		source: "user" as const,
		protocol: "openai-compatible" as const,
		provider: "fixture",
		model: "fixture-model",
		baseUrl,
		capabilities: {
			tools: "supported" as const,
			structuredOutput: "unknown" as const,
			streaming: "unknown" as const,
			usageReporting: "unknown" as const,
		},
	};
}

let running: http.Server | null = null;

afterEach(() => {
	running?.close();
	running = null;
});

describe("Mastra orchestration against a local OpenAI-compatible fixture", () => {
	it("runs the trainer tool loop over protected chat completions", async () => {
		const fixture = await startFixture("trainer");
		running = fixture.server;
		const result = await runTrainer({
			supabase: mockSupabase() as never,
			userId: USER,
			sessionId: SESSION,
			role: "trainer",
			config: supportedConfig(fixture.href),
			apiKey: SENTINEL,
			messages: [{ role: "user", content: "What does the snapshot ask?" }],
		});
		expect(result.tools).toContain("get-exercise-snapshot");
		expect(result.text).toMatch(/snapshot/i);
		expect(result.text).not.toContain(SENTINEL);
		expect(fixture.requests.length).toBeGreaterThan(0);
		expect(JSON.stringify(fixture.requests)).not.toContain(SENTINEL);
	}, 30_000);

	it("runs the review tool loop and returns coaching JSON only", async () => {
		const fixture = await startFixture("review");
		running = fixture.server;
		const result = await runReview({
			supabase: mockSupabase() as never,
			userId: USER,
			sessionId: SESSION,
			role: "review",
			config: supportedConfig(fixture.href),
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
			]),
		);
		expect(result.model.summary).toMatch(/snapshot/i);
		expect(JSON.stringify(result.model)).not.toMatch(/\d+\s+tokens/);
	}, 30_000);

	it("fails closed when the fixture redirects off origin", async () => {
		const fixture = await startFixture("redirect");
		running = fixture.server;
		await expect(
			runTrainer({
				supabase: mockSupabase() as never,
				userId: USER,
				sessionId: SESSION,
				role: "trainer",
				config: supportedConfig(fixture.href),
				apiKey: SENTINEL,
				messages: [{ role: "user", content: "hello" }],
			}),
		).rejects.toThrow(/redirect/i);
	}, 30_000);
});
