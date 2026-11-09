import { assembleEditorLearningReport } from "../capture/report";
import { usageCopy as captureUsageCopy } from "../capture/usage-copy";
import { usageFromStoredRecords } from "../reports/assemble";
import { type LearningReport, reportSchema } from "../reports/schema";
import { dayBucket } from "../sessions/service";
import type {
	ProgressEditorInput,
	ProgressSection,
	ProgressSessionInput,
	ProgressTask,
	ProgressTrendPoint,
	ProgressUsage,
	ProgressView,
	TokenCoverage,
} from "./types";

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

function taskFromSession(
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
	return {
		source: "trainer",
		sessionId: session.id,
		exerciseId: session.exerciseId,
		status: session.status,
		occurredAt,
		reportHref: `/session/${session.id}/report`,
		prompts: session.prompts.filter((prompt) => prompt.trim().length > 0),
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
		suggestions: body
			? body.suggestions.map((suggestion) => ({
					title: suggestion.title,
					improvedExample: suggestion.improvedExample,
					whyItHelps: suggestion.whyItHelps,
					illustrative: suggestion.illustrative,
				}))
			: [],
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

function taskFromEditor(
	task: ProgressEditorInput,
	occurredAtStamp: string
): ProgressTask {
	const assembled = assembleEditorLearningReport({
		taskId: task.id,
		events: task.events,
		usage: task.usage,
	});
	const body = assembled.ok ? assembled.report : null;
	return {
		source: "editor",
		sessionId: task.id,
		exerciseId: `${task.editor} · ${task.editorTaskId}`,
		status: task.status,
		occurredAt: occurredAtStamp,
		reportHref: `/capture/tasks/${task.id}`,
		prompts: task.prompts.filter((prompt) => prompt.trim().length > 0),
		usage: progressUsageFromEditor(body?.usage.editor),
		reportStatus: body ? "complete" : "none",
		outcome: body
			? {
					observed: body.outcome.observed,
					verification: body.outcome.verification,
					verificationProvenance: body.outcome.verificationProvenance,
				}
			: null,
		tests: {
			found: false,
			passed: null,
			failed: null,
			total: null,
		},
		suggestions: body
			? body.suggestions.map((suggestion) => ({
					title: suggestion.title,
					improvedExample: suggestion.improvedExample,
					whyItHelps: suggestion.whyItHelps,
					illustrative: suggestion.illustrative,
				}))
			: [],
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
		const input = measured.reduce(
			(sum, task) => sum + (task.usage.inputTokens ?? 0),
			0
		);
		const output = measured.reduce(
			(sum, task) => sum + (task.usage.outputTokens ?? 0),
			0
		);
		return {
			date,
			taskCount: dayTasks.length,
			measuredTaskCount: measured.length,
			measuredInputTokens: measured.length > 0 ? input : null,
			measuredOutputTokens: measured.length > 0 ? output : null,
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
	return {
		timezone,
		days: trainer.days,
		trend: trainer.trend,
		editor,
	};
}

export function usageCopy(
	usage: ProgressUsage,
	source: ProgressTask["source"] = "trainer"
): string {
	if (source === "editor") {
		return captureUsageCopy(
			{
				cachedTokens: usage.cachedTokens,
				inputTokens: usage.inputTokens,
				outputTokens: usage.outputTokens,
				provenance: usage.label,
				reasoningTokens: usage.reasoningTokens ?? null,
				source: usage.source ?? "none",
			},
			"this editor"
		);
	}
	if (usage.label === "missing") {
		return "Token counts were not reported by the provider for this task. Totals are omitted, not guessed.";
	}
	const cached =
		usage.cachedTokens == null
			? "cached not reported"
			: `${usage.cachedTokens} cached`;
	const input =
		usage.inputTokens == null
			? "input not reported"
			: `${usage.inputTokens} input`;
	const output =
		usage.outputTokens == null
			? "output not reported"
			: `${usage.outputTokens} output`;
	if (usage.coverage === "partial") {
		return `${input}, ${output}, ${cached}. Partial vendor report.`;
	}
	return `${input}, ${output}, ${cached}. Reported by the trainer provider.`;
}
