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
	events?: ProgressEditorInput["events"];
	finishedAt: string;
	id: string;
	inputTokens: number | null;
	outputTokens: number | null;
	prompts: string[];
	provenance: "estimated" | "measured" | "missing";
	source: string;
	startedAt: string;
	storedReport?: ProgressEditorInput["storedReport"];
}): ProgressEditorInput {
	const events: ProgressEditorInput["events"] =
		input.events ??
		input.prompts.map((text, index) => ({
			id: `${input.id}-prompt-${String(index)}`,
			kind: "prompt",
			occurredAt: input.startedAt,
			payload: { text },
		}));
	if (!events.some((event) => event.kind === "session_end")) {
		events.push({
			id: `${input.id}-end`,
			kind: "session_end",
			occurredAt: input.finishedAt,
			payload: { reason: "stop" },
		});
	}
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
		storedReport: input.storedReport,
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

const cursorPromptId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const cursorFollowUpId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const cursorResponseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const cursorFollowResponseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4";
const cursorFileAuthId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5";
const cursorFileSessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa6";

const cursorCoachedBody = {
	kind: "coached" as const,
	summary:
		"The captured Cursor session named a flaky auth test, then asked to make it pass. Naming the file and the failing assertion would have given the agent a checkable target instead of a rewrite.",
	observations: {
		tests: {
			found: false,
			passed: null,
			failed: null,
			total: null,
			fatal: null,
			provenance: "insufficient_evidence" as const,
		},
	},
	outcome: {
		observed: "Editor task closed (stop).",
		verification:
			"The server did not independently execute editor code. Suggestions below are not a measured result.",
		verificationProvenance: "insufficient_evidence" as const,
	},
	suggestions: [
		{
			title: "Ask for the failing assertion, not a rewrite",
			detail:
				"The first stored prompt was 'Fix the flaky test'. The second was 'just make it pass'. Neither named the assertion or timeout.",
			improvedExample:
				"In src/auth.test.ts, which assertion fails when the session cookie expires, and what timeout is the test using?",
			whyItHelps:
				"The stored prompts asked for a generic fix. Naming the file, assertion, and timeout gives the agent a checkable target instead of a rewrite.",
			citations: [
				{
					evidenceId: cursorPromptId,
					kind: "prompt" as const,
					note: "first captured prompt",
				},
			],
			illustrative: false,
		},
		{
			title: "Keep the second prompt diagnostic",
			detail:
				"After the first rewrite, the follow-up still asked to make the test pass instead of asking what still failed.",
			improvedExample:
				"After that edit, which test in src/auth.test.ts still fails, and what is the exact assertion error?",
			whyItHelps:
				"A diagnostic follow-up uses the captured failure instead of repeating 'make it pass', which hides whether the timeout or the cookie check is still wrong.",
			citations: [
				{
					evidenceId: cursorFollowUpId,
					kind: "prompt" as const,
					note: "follow-up prompt",
				},
			],
			illustrative: false,
		},
	],
	usage: {
		trainer: {
			inputTokens: null,
			outputTokens: null,
			cachedTokens: null,
			coverage: "unknown" as const,
		},
		review: {
			inputTokens: null,
			outputTokens: null,
			cachedTokens: null,
			coverage: "unknown" as const,
		},
		editor: {
			cachedTokens: null,
			coverage: "partial" as const,
			inputTokens: 48,
			outputTokens: 19,
			provenance: "estimated" as const,
			source: "text_estimate",
		},
		incomplete: true,
	},
	insufficientEvidence: [
		"Token counts are labelled text_estimate from captured text length. They are not vendor-measured.",
		"The server did not run the edited tests.",
	],
};

const cursorFactsBody = {
	kind: "facts_only" as const,
	summary:
		"Facts only. Two prompts and two edited files were captured. Coaching is omitted until a saved BYOK key is available.",
	observations: {
		tests: {
			found: false,
			passed: null,
			failed: null,
			total: null,
			fatal: null,
			provenance: "insufficient_evidence" as const,
		},
	},
	outcome: {
		observed: "Editor task closed (stop).",
		verification:
			"The server did not independently execute editor code. Suggestions below are not a measured result.",
		verificationProvenance: "insufficient_evidence" as const,
	},
	suggestions: [],
	usage: {
		trainer: {
			inputTokens: null,
			outputTokens: null,
			cachedTokens: null,
			coverage: "unknown" as const,
		},
		review: {
			inputTokens: null,
			outputTokens: null,
			cachedTokens: null,
			coverage: "unknown" as const,
		},
		editor: {
			cachedTokens: null,
			coverage: "partial" as const,
			inputTokens: 36,
			outputTokens: 11,
			provenance: "estimated" as const,
			source: "text_estimate",
		},
		incomplete: true,
	},
	insufficientEvidence: [
		"No saved BYOK key. Coaching was not generated.",
		"Token counts are labelled text_estimate from captured text length.",
	],
};

function cursorCaptureEvents(input: {
	endAt: string;
	fileAuthAt: string;
	fileSessionAt: string;
	first: {
		text: string;
		at: string;
		inputTokens: number;
		outputTokens: number;
	};
	firstResponse: { text: string; at: string };
	followId: string;
	followResponseId: string;
	fileAuthId: string;
	fileSessionId: string;
	id: string;
	promptId: string;
	responseId: string;
	second: {
		text: string;
		at: string;
		inputTokens: number;
		outputTokens: number;
	};
	secondResponse: { text: string; at: string };
}): ProgressEditorInput["events"] {
	return [
		{
			id: input.promptId,
			kind: "prompt",
			occurredAt: input.first.at,
			payload: {
				inputTokens: input.first.inputTokens,
				outputTokens: input.first.outputTokens,
				text: input.first.text,
				tokenLabel: "estimated",
				tokenSource: "text_estimate",
			},
		},
		{
			id: input.responseId,
			kind: "response",
			occurredAt: input.firstResponse.at,
			payload: { text: input.firstResponse.text },
		},
		{
			id: input.fileAuthId,
			kind: "file_edit",
			occurredAt: input.fileAuthAt,
			payload: { path: "src/auth.test.ts" },
		},
		{
			id: input.followId,
			kind: "prompt",
			occurredAt: input.second.at,
			payload: {
				inputTokens: input.second.inputTokens,
				outputTokens: input.second.outputTokens,
				text: input.second.text,
				tokenLabel: "estimated",
				tokenSource: "text_estimate",
			},
		},
		{
			id: input.followResponseId,
			kind: "response",
			occurredAt: input.secondResponse.at,
			payload: { text: input.secondResponse.text },
		},
		{
			id: input.fileSessionId,
			kind: "file_edit",
			occurredAt: input.fileSessionAt,
			payload: { path: "src/session.ts" },
		},
		{
			id: `${input.id}-end`,
			kind: "session_end",
			occurredAt: input.endAt,
			payload: { reason: "stop" },
		},
	];
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
	editorTaskId: "test-data-flaky-auth",
	events: cursorCaptureEvents({
		endAt: "2026-11-09T11:18:00.000Z",
		fileAuthAt: "2026-11-09T11:08:00.000Z",
		fileAuthId: cursorFileAuthId,
		fileSessionAt: "2026-11-09T11:16:00.000Z",
		fileSessionId: cursorFileSessionId,
		first: {
			at: "2026-11-09T11:00:00.000Z",
			inputTokens: 28,
			outputTokens: 8,
			text: "Fix the flaky test",
		},
		firstResponse: {
			at: "2026-11-09T11:06:00.000Z",
			text: "I'll rewrite src/auth.test.ts to retry the login assertion until it passes.",
		},
		followId: cursorFollowUpId,
		followResponseId: cursorFollowResponseId,
		id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
		promptId: cursorPromptId,
		responseId: cursorResponseId,
		second: {
			at: "2026-11-09T11:12:00.000Z",
			inputTokens: 20,
			outputTokens: 11,
			text: "just make it pass",
		},
		secondResponse: {
			at: "2026-11-09T11:14:00.000Z",
			text: "Bumped the timeout in src/session.ts and skipped the cookie expiry case.",
		},
	}),
	finishedAt: "2026-11-09T11:18:00.000Z",
	id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
	inputTokens: 48,
	outputTokens: 19,
	prompts: ["Fix the flaky test", "just make it pass"],
	provenance: "estimated",
	source: "text_estimate",
	startedAt: "2026-11-09T11:00:00.000Z",
	storedReport: {
		body: cursorCoachedBody,
		error: null,
		status: "complete",
	},
});

const factsOnlyTask = editor({
	cachedTokens: null,
	editor: "cursor",
	editorTaskId: "test-data-facts-only",
	events: cursorCaptureEvents({
		endAt: "2026-11-09T14:08:00.000Z",
		fileAuthAt: "2026-11-09T14:03:00.000Z",
		fileAuthId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7",
		fileSessionAt: "2026-11-09T14:06:00.000Z",
		fileSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8",
		first: {
			at: "2026-11-09T14:00:00.000Z",
			inputTokens: 22,
			outputTokens: 6,
			text: "The login hook flakes in CI.",
		},
		firstResponse: {
			at: "2026-11-09T14:02:00.000Z",
			text: "I'll add a sleep in src/auth.test.ts before the assertion.",
		},
		followId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9",
		followResponseId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10",
		id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
		promptId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11",
		responseId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12",
		second: {
			at: "2026-11-09T14:04:00.000Z",
			inputTokens: 14,
			outputTokens: 5,
			text: "ship it",
		},
		secondResponse: {
			at: "2026-11-09T14:05:00.000Z",
			text: "Left a 250ms delay in src/session.ts.",
		},
	}),
	finishedAt: "2026-11-09T14:08:00.000Z",
	id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
	inputTokens: 36,
	outputTokens: 11,
	prompts: ["The login hook flakes in CI.", "ship it"],
	provenance: "estimated",
	source: "text_estimate",
	startedAt: "2026-11-09T14:00:00.000Z",
	storedReport: {
		body: cursorFactsBody,
		error: null,
		status: "complete",
	},
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
		factsOnlyTask,
		...extraEditor,
	]);
}

export function seededDetailTask() {
	const task = seededProgressView().tasks.find(
		(item) => item.sessionId === editorTask.id
	);
	if (!task) {
		throw new Error("expected the Cursor capture fixture task");
	}
	return task;
}

export function seededFactsOnlyTask() {
	const task = seededProgressView().tasks.find(
		(item) => item.sessionId === factsOnlyTask.id
	);
	if (!task) {
		throw new Error("expected the facts-only Cursor fixture task");
	}
	return task;
}

export function seededCaptureViewerTasks() {
	return [
		{
			editor: editorTask.editor,
			editorTaskId: editorTask.editorTaskId,
			filePaths: ["src/auth.test.ts", "src/session.ts"],
			id: editorTask.id,
			prompts: editorTask.prompts,
			status: editorTask.status,
			usage: editorTask.usage,
		},
		{
			editor: factsOnlyTask.editor,
			editorTaskId: factsOnlyTask.editorTaskId,
			filePaths: ["src/auth.test.ts", "src/session.ts"],
			id: factsOnlyTask.id,
			prompts: factsOnlyTask.prompts,
			status: factsOnlyTask.status,
			usage: factsOnlyTask.usage,
		},
	];
}
