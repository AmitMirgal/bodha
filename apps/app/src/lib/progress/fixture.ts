import type {
	ProgressEditorInput,
	ProgressSessionInput,
	ProgressView,
} from "./types";
import { assembleProgressView } from "./view";

const promptId = "11111111-1111-4111-8111-111111111111";

function reportBody(input: {
	example: string;
	failed: number;
	observed: string;
	passed: number;
	prompt: string;
	title: string;
	total: number;
	why: string;
	inputTokens: number;
	outputTokens: number;
	cachedTokens: number | null;
	coverage: "complete" | "partial";
}) {
	return {
		summary: "The learner ran tests.",
		observations: {
			tests: {
				found: true,
				passed: input.passed,
				failed: input.failed,
				total: input.total,
				fatal: null,
				provenance: "browser_harness" as const,
			},
		},
		outcome: {
			observed: input.observed,
			verification:
				"Results are browser-harness observations, not independent server execution.",
			verificationProvenance: "browser_harness" as const,
		},
		suggestions: [
			{
				title: input.title,
				detail: "The prompt asked for a rewrite.",
				improvedExample: input.example,
				whyItHelps: input.why,
				citations: [
					{ evidenceId: promptId, kind: "prompt" as const, note: "prompt" },
				],
				illustrative: false,
			},
		],
		usage: {
			trainer: {
				inputTokens: input.inputTokens,
				outputTokens: input.outputTokens,
				cachedTokens: input.cachedTokens,
				coverage: input.coverage,
			},
			review: {
				inputTokens: null,
				outputTokens: null,
				cachedTokens: null,
				coverage: "unknown" as const,
			},
			incomplete: true,
		},
		insufficientEvidence: [],
	};
}

function trainer(
	id: string,
	exerciseId: string,
	iso: string,
	prompts: string[],
	usage: ProgressSessionInput["usageRows"],
	report: ProgressSessionInput["report"]
): ProgressSessionInput {
	return {
		id,
		exerciseId,
		status: report ? "complete" : "running",
		createdAt: iso,
		startedAt: iso,
		finishedAt: report ? iso : null,
		prompts,
		usageRows: usage,
		report,
	};
}

function measuredUsage(
	input: number | null,
	output: number | null,
	cached: number | null,
	coverage: "complete" | "partial"
): ProgressSessionInput["usageRows"] {
	return [
		{
			agent_role: "trainer",
			cached_included_in_input: false,
			cached_tokens: cached,
			coverage,
			input_tokens: input,
			native: null,
			output_tokens: output,
		},
	];
}

function editor(input: {
	cachedTokens: number | null;
	editor: string;
	editorTaskId: string;
	finishedAt: string;
	id: string;
	inputTokens: number | null;
	outputTokens: number | null;
	prompts: string[];
	provenance: "estimated" | "measured" | "missing";
	source: string;
	startedAt: string;
}): ProgressEditorInput {
	const events: ProgressEditorInput["events"] = input.prompts.map(
		(text, index) => ({
			id: `${input.id}-prompt-${String(index)}`,
			kind: "prompt",
			occurredAt: input.startedAt,
			payload: { text },
		})
	);
	events.push({
		id: `${input.id}-end`,
		kind: "session_end",
		occurredAt: input.finishedAt,
		payload: { reason: "stop" },
	});
	return {
		id: input.id,
		deviceId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
		editor: input.editor,
		editorTaskId: input.editorTaskId,
		status: "closed",
		startedAt: input.startedAt,
		finishedAt: input.finishedAt,
		prompts: input.prompts,
		events,
		usage:
			input.provenance === "missing"
				? []
				: [
						{
							cachedTokens: input.cachedTokens,
							inputTokens: input.inputTokens,
							outputTokens: input.outputTokens,
							provenance: input.provenance,
							source: input.source,
						},
					],
	};
}

const shelfBody = reportBody({
	cachedTokens: 2,
	coverage: "complete",
	example: "Which test fails first?",
	failed: 2,
	inputTokens: 12,
	observed:
		"Latest browser harness run observed 1 passing and 2 failing of 3 tests.",
	outputTokens: 4,
	passed: 1,
	prompt: "Which test fails first?",
	title: "Ask about the failing test",
	total: 3,
	why: "It uses the recorded prompt.",
});

const queueBody = reportBody({
	cachedTokens: 8,
	coverage: "complete",
	example: "Which queue test fails when two workers ack the same job?",
	failed: 0,
	inputTokens: 40,
	observed: "Latest browser harness run observed 3 passing of 3 tests.",
	outputTokens: 12,
	passed: 3,
	prompt: "Fix the queue.",
	title: "Name the failing worker race",
	total: 3,
	why: "The stored prompt never mentioned the race the tests encode.",
});

const authBody = reportBody({
	cachedTokens: 4,
	coverage: "complete",
	example: "What does the login test expect when the password is empty?",
	failed: 1,
	inputTokens: 22,
	observed:
		"Latest browser harness run observed 2 passing and 1 failing of 3 tests.",
	outputTokens: 9,
	passed: 2,
	prompt: "Make login work.",
	title: "Ask for the empty-password assertion",
	total: 3,
	why: "The prompt asked for a generic fix instead of the failing case.",
});

const measured: ProgressSessionInput = trainer(
	"sess-measured",
	"shelf",
	"2026-11-08T12:00:00.000Z",
	["Which test fails first?"],
	measuredUsage(12, 4, 2, "complete"),
	{ status: "complete", body: shelfBody }
);

const missing: ProgressSessionInput = trainer(
	"sess-missing",
	"cache",
	"2026-11-09T10:00:00.000Z",
	["Help me finish the cache exercise."],
	[],
	null
);

const editorTask = editor({
	cachedTokens: null,
	editor: "cursor",
	editorTaskId: "conv-editor-1",
	finishedAt: "2026-11-09T11:10:00.000Z",
	id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
	inputTokens: 20,
	outputTokens: 5,
	prompts: ["Fix the flaky test"],
	provenance: "estimated",
	source: "text_estimate",
	startedAt: "2026-11-09T11:00:00.000Z",
});

const extraTrainer: ProgressSessionInput[] = [
	trainer(
		"sess-queue",
		"queue",
		"2026-11-01T15:00:00.000Z",
		["Fix the queue.", "The worker still double-acks."],
		measuredUsage(40, 12, 8, "complete"),
		{ status: "complete", body: queueBody }
	),
	trainer(
		"sess-search",
		"search",
		"2026-11-04T16:00:00.000Z",
		["Why is search empty?"],
		[],
		null
	),
	trainer(
		"sess-partial",
		"billing",
		"2026-11-05T13:00:00.000Z",
		["The invoice total looks wrong."],
		measuredUsage(15, null, 2, "partial"),
		null
	),
	trainer(
		"sess-auth",
		"auth",
		"2026-11-07T18:00:00.000Z",
		["Make login work.", "Empty password still signs in."],
		measuredUsage(22, 9, 4, "complete"),
		{ status: "complete", body: authBody }
	),
];

const extraEditor: ProgressEditorInput[] = [
	editor({
		cachedTokens: null,
		editor: "cursor",
		editorTaskId: "conv-nav",
		finishedAt: "2026-11-02T12:20:00.000Z",
		id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
		inputTokens: 30,
		outputTokens: 10,
		prompts: ["The settings nav does not highlight the active page."],
		provenance: "estimated",
		source: "text_estimate",
		startedAt: "2026-11-02T12:00:00.000Z",
	}),
	editor({
		cachedTokens: 14,
		editor: "copilot",
		editorTaskId: "conv-otel-1",
		finishedAt: "2026-11-03T09:40:00.000Z",
		id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
		inputTokens: 80,
		outputTokens: 22,
		prompts: [
			"Generate the Zod schema.",
			"Keep the refine on empty strings.",
			"Do not invent a default email.",
		],
		provenance: "measured",
		source: "copilot_otel_chat_span",
		startedAt: "2026-11-03T09:00:00.000Z",
	}),
	editor({
		cachedTokens: null,
		editor: "vscode-copilot",
		editorTaskId: "conv-otel-2",
		finishedAt: "2026-11-06T17:15:00.000Z",
		id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3",
		inputTokens: 50,
		outputTokens: 18,
		prompts: ["Explain this failing Copilot hook test."],
		provenance: "measured",
		source: "copilot_otel_chat_span",
		startedAt: "2026-11-06T17:00:00.000Z",
	}),
	editor({
		cachedTokens: null,
		editor: "cursor",
		editorTaskId: "conv-redact",
		finishedAt: "2026-11-10T10:05:00.000Z",
		id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4",
		inputTokens: null,
		outputTokens: null,
		prompts: ["Redact the token before ingest."],
		provenance: "missing",
		source: "none",
		startedAt: "2026-11-10T10:00:00.000Z",
	}),
];

export function emptyProgressView(): ProgressView {
	return assembleProgressView([], "UTC");
}

export function seededProgressView(): ProgressView {
	return assembleProgressView([measured, missing, ...extraTrainer], "UTC", [
		editorTask,
		...extraEditor,
	]);
}

export function seededDetailTask() {
	const task = seededProgressView().tasks.find(
		(item) => item.sessionId === "sess-measured"
	);
	if (!task) {
		throw new Error("expected the shelf fixture task");
	}
	return task;
}
