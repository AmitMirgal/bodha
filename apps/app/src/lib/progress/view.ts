import {
	assembleEditorLearningReport,
	filePathsFromCaptureEvents,
	responsesFromCaptureEvents,
} from "../capture/report";
import { usageFromStoredRecords } from "../reports/assemble";
import { type LearningReport, reportSchema } from "../reports/schema";
import { dayBucket } from "../sessions/service";
import { chartFromTasks, summaryFromTasks, sumTokenField } from "./aggregate";
import type {
	ProgressEditorInput,
	ProgressOrigin,
	ProgressPromptTurn,
	ProgressReportKind,
	ProgressSection,
	ProgressSessionInput,
	ProgressSuggestion,
	ProgressTask,
	ProgressTrendPoint,
	ProgressUsage,
	ProgressView,
	TokenCoverage,
} from "./types";

export { chartFromTasks, summaryFromTasks, usageCopy } from "./aggregate";

function coverageOf(value: string): TokenCoverage {
	switch (value) {
		case "complete":
		case "partial":
		case "unknown":
			return value;
		default:
			return "unknown";
	}
}

function trainerUsage(rows: ProgressSessionInput["usageRows"]): ProgressUsage {
	const packed = usageFromStoredRecords(rows).trainer;
	const coverage = coverageOf(packed.coverage);
	const hasNumber =
		packed.inputTokens != null ||
		packed.outputTokens != null ||
		packed.cachedTokens != null;
	if (coverage === "unknown" || !hasNumber) {
		return {
			inputTokens: null,
			outputTokens: null,
			cachedTokens: null,
			coverage: "unknown",
			label: "missing",
		};
	}
	return {
		inputTokens: packed.inputTokens,
		outputTokens: packed.outputTokens,
		cachedTokens: packed.cachedTokens,
		coverage,
		label: "measured",
	};
}

function reportStatus(
	report: ProgressSessionInput["report"]
): ProgressTask["reportStatus"] {
	if (!report) {
		return "none";
	}
	if (report.status === "complete") {
		return "complete";
	}
	if (report.status === "error" || report.status === "failed") {
		return "error";
	}
	return "pending";
}

function mapSuggestions(
	suggestions: Array<{
		detail: string;
		illustrative: boolean;
		improvedExample: string;
		title: string;
		whyItHelps: string;
	}>
): ProgressSuggestion[] {
	return suggestions.map((suggestion) => ({
		detail: suggestion.detail,
		illustrative: suggestion.illustrative,
		improvedExample: suggestion.improvedExample,
		title: suggestion.title,
		whyItHelps: suggestion.whyItHelps,
	}));
}

function trainerReportKind(
	status: ProgressTask["reportStatus"],
	suggestions: ProgressSuggestion[]
): ProgressReportKind {
	if (suggestions.length > 0) {
		return "coached";
	}
	if (status === "complete") {
		return "facts_only";
	}
	return "none";
}

function captureReportKind(
	stored: ProgressEditorInput["storedReport"]
): ProgressReportKind {
	if (!stored || reportStatus(stored) !== "complete") {
		return "none";
	}
	if (
		stored.body &&
		typeof stored.body === "object" &&
		"kind" in stored.body &&
		stored.body.kind === "coached"
	) {
		return "coached";
	}
	return "facts_only";
}

export function taskFromSession(
	session: ProgressSessionInput,
	occurredAt: string
): ProgressTask {
	const usage = trainerUsage(session.usageRows);
	const status = reportStatus(session.report);
	const parsed =
		session.report?.body == null
			? null
			: reportSchema.safeParse(session.report.body);
	const body = parsed?.success ? parsed.data : null;
	const prompts = session.prompts.filter((prompt) => prompt.trim().length > 0);
	const suggestions = body ? mapSuggestions(body.suggestions) : [];
	return {
		coachingSummary: body?.summary ?? null,
		filePaths: [],
		finishedAt: session.finishedAt,
		needsKey: false,
		reportError: null,
		reportKind: trainerReportKind(status, suggestions),
		responses: [],
		source: "trainer",
		origin: "trainer",
		sessionId: session.id,
		exerciseId: session.exerciseId,
		startedAt: session.startedAt,
		status: session.status,
		occurredAt,
		reportHref: `/session/${session.id}/report`,
		prompts,
		promptTurns: promptTurnsFromTexts(prompts, {
			inputTokens: null,
			outputTokens: null,
			cachedTokens: null,
			coverage: "unknown",
			label: "missing",
		}),
		usage,
		reportStatus: status,
		outcome: body
			? {
					observed: body.outcome.observed,
					verification: body.outcome.verification,
					verificationProvenance: body.outcome.verificationProvenance,
				}
			: null,
		tests: body
			? {
					found: body.observations.tests.found,
					passed: body.observations.tests.passed,
					failed: body.observations.tests.failed,
					total: body.observations.tests.total,
				}
			: null,
		suggestions,
	};
}

function occurredAt(session: ProgressSessionInput): string {
	return session.finishedAt ?? session.startedAt ?? session.createdAt;
}

function progressUsageFromEditor(
	editor: NonNullable<LearningReport["usage"]["editor"]> | null | undefined
): ProgressUsage {
	if (!editor || editor.provenance === "missing") {
		return {
			inputTokens: null,
			outputTokens: null,
			cachedTokens: null,
			reasoningTokens: null,
			coverage: "unknown",
			label: "missing",
			source: editor?.source ?? "none",
		};
	}
	if (editor.provenance === "estimated") {
		return {
			inputTokens: editor.inputTokens,
			outputTokens: editor.outputTokens,
			cachedTokens: null,
			reasoningTokens: null,
			coverage: "partial",
			label: "estimated",
			source: editor.source,
		};
	}
	return {
		inputTokens: editor.inputTokens,
		outputTokens: editor.outputTokens,
		cachedTokens: editor.cachedTokens,
		reasoningTokens: editor.reasoningTokens ?? null,
		coverage: editor.coverage,
		label: "measured",
		source: editor.source,
	};
}

export function taskFromEditor(
	task: ProgressEditorInput,
	occurredAtStamp: string
): ProgressTask {
	const assembled = assembleEditorLearningReport({
		taskId: task.id,
		events: task.events,
		usage: task.usage,
	});
	const facts = assembled.ok ? assembled.report : null;
	const storedParsed =
		task.storedReport?.body == null
			? null
			: reportSchema.safeParse(task.storedReport.body);
	const storedBody = storedParsed?.success ? storedParsed.data : null;
	const reportKind = captureReportKind(task.storedReport);
	const prompts = task.prompts.filter((prompt) => prompt.trim().length > 0);
	const usage = progressUsageFromEditor(facts?.usage.editor);
	const coaching = reportKind === "coached" ? storedBody : null;
	return {
		coachingSummary: coaching?.summary ?? null,
		filePaths: filePathsFromCaptureEvents(task.events),
		finishedAt: task.finishedAt,
		needsKey: reportKind !== "coached",
		reportError: task.storedReport?.error ?? null,
		reportKind,
		responses: responsesFromCaptureEvents(task.events),
		source: "editor",
		origin: originFromEditor(task.editor),
		sessionId: task.id,
		exerciseId: `${task.editor} · ${task.editorTaskId}`,
		startedAt: task.startedAt,
		status: task.status,
		occurredAt: occurredAtStamp,
		reportHref: `/capture/tasks/${task.id}`,
		prompts,
		promptTurns: promptTurnsFromEvents(task, usage),
		usage,
		reportStatus: reportStatus(task.storedReport ?? null),
		outcome: facts
			? {
					observed: facts.outcome.observed,
					verification: facts.outcome.verification,
					verificationProvenance: facts.outcome.verificationProvenance,
				}
			: null,
		tests: {
			found: false,
			passed: null,
			failed: null,
			total: null,
		},
		suggestions: coaching ? mapSuggestions(coaching.suggestions) : [],
	};
}

function sectionFromTasks(
	tasks: ProgressTask[],
	timezone: string,
	occurred: string[]
): ProgressSection {
	const days = new Map<string, ProgressTask[]>();
	tasks.forEach((task, index) => {
		const stamp = occurred[index] ?? task.occurredAt;
		const date = dayBucket(stamp, timezone);
		const list = days.get(date) ?? [];
		list.push(task);
		days.set(date, list);
	});
	const ordered = [...days.entries()].sort(([a], [b]) => b.localeCompare(a));
	const trend: ProgressTrendPoint[] = ordered.map(([date, dayTasks]) => {
		const measured = dayTasks.filter((task) => task.usage.label === "measured");
		return {
			date,
			measuredInputTokens: sumTokenField(measured, "inputTokens"),
			measuredOutputTokens: sumTokenField(measured, "outputTokens"),
			measuredTaskCount: measured.length,
			taskCount: dayTasks.length,
		};
	});
	return {
		days: ordered.map(([date, dayTasks]) => ({ date, tasks: dayTasks })),
		trend,
	};
}

export function assembleProgressView(
	sessions: ProgressSessionInput[],
	timezone: string,
	editorTasks: ProgressEditorInput[] = []
): ProgressView {
	const trainerTasks: ProgressTask[] = [];
	const trainerOccurred: string[] = [];
	for (const session of sessions) {
		const stamp = occurredAt(session);
		trainerOccurred.push(stamp);
		trainerTasks.push(taskFromSession(session, stamp));
	}
	const trainer = sectionFromTasks(trainerTasks, timezone, trainerOccurred);
	const editorBuilt: ProgressTask[] = [];
	const editorOccurred: string[] = [];
	for (const task of editorTasks) {
		const stamp = task.finishedAt ?? task.startedAt;
		editorOccurred.push(stamp);
		editorBuilt.push(taskFromEditor(task, stamp));
	}
	const editor = sectionFromTasks(editorBuilt, timezone, editorOccurred);
	const tasks = [...trainerTasks, ...editorBuilt].sort((left, right) =>
		right.occurredAt.localeCompare(left.occurredAt)
	);
	return {
		timezone,
		days: trainer.days,
		trend: trainer.trend,
		editor,
		tasks,
		summary: summaryFromTasks(tasks),
		chart: chartFromTasks(tasks, timezone),
	};
}

function originFromEditor(editor: string): ProgressOrigin {
	const value = editor.toLowerCase();
	if (value.includes("copilot") || value.includes("vscode")) {
		return "copilot";
	}
	return "cursor";
}

function promptTurnsFromTexts(
	prompts: string[],
	usage: ProgressUsage
): ProgressPromptTurn[] {
	return prompts.map((text) => ({
		text,
		occurredAt: null,
		usage,
	}));
}

function numberField(payload: object, key: string): number | null {
	if (!(key in payload)) {
		return null;
	}
	const value = Reflect.get(payload, key);
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function usageFromPromptPayload(
	payload: unknown,
	fallbackSource: string | undefined
): ProgressUsage {
	const missing: ProgressUsage = {
		cachedTokens: null,
		coverage: "unknown",
		inputTokens: null,
		label: "missing",
		outputTokens: null,
		source: fallbackSource,
	};
	if (!payload || typeof payload !== "object") {
		return missing;
	}
	const inputTokens = numberField(payload, "inputTokens");
	const outputTokens = numberField(payload, "outputTokens");
	if (inputTokens == null && outputTokens == null) {
		return missing;
	}
	const tokenLabel = Reflect.get(payload, "tokenLabel");
	const tokenSource = Reflect.get(payload, "tokenSource");
	const label: ProgressUsage["label"] =
		tokenLabel === "measured" ? "measured" : "estimated";
	return {
		cachedTokens: numberField(payload, "cachedTokens"),
		coverage: "partial",
		inputTokens,
		label,
		outputTokens,
		source: typeof tokenSource === "string" ? tokenSource : fallbackSource,
	};
}

function promptTurnsFromEvents(
	task: ProgressEditorInput,
	fallback: ProgressUsage
): ProgressPromptTurn[] {
	const turns = task.events
		.filter((event) => event.kind === "prompt")
		.map((event) => {
			const payload = event.payload;
			const text =
				payload &&
				typeof payload === "object" &&
				"text" in payload &&
				typeof payload.text === "string"
					? payload.text
					: "";
			return {
				occurredAt: event.occurredAt,
				text,
				usage: usageFromPromptPayload(payload, fallback.source),
			};
		})
		.filter((turn) => turn.text.trim().length > 0);
	if (turns.length > 0) {
		return turns;
	}
	return promptTurnsFromTexts(task.prompts, {
		cachedTokens: null,
		coverage: "unknown",
		inputTokens: null,
		label: "missing",
		outputTokens: null,
		source: fallback.source,
	});
}
