import { usageFromStoredRecords } from "../reports/assemble";
import { reportSchema } from "../reports/schema";
import { dayBucket } from "../sessions/service";
import type {
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

export function assembleProgressView(
	sessions: ProgressSessionInput[],
	timezone: string
): ProgressView {
	const days = new Map<string, ProgressTask[]>();
	for (const session of sessions) {
		const stamp = occurredAt(session);
		const date = dayBucket(stamp, timezone);
		const list = days.get(date) ?? [];
		list.push(taskFromSession(session, stamp));
		days.set(date, list);
	}
	const ordered = [...days.entries()].sort(([a], [b]) => b.localeCompare(a));
	const trend: ProgressTrendPoint[] = ordered.map(([date, tasks]) => {
		const measured = tasks.filter((task) => task.usage.label === "measured");
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
			taskCount: tasks.length,
			measuredTaskCount: measured.length,
			measuredInputTokens: measured.length > 0 ? input : null,
			measuredOutputTokens: measured.length > 0 ? output : null,
		};
	});
	return {
		timezone,
		days: ordered.map(([date, tasks]) => ({ date, tasks })),
		trend,
	};
}

export function usageCopy(usage: ProgressUsage): string {
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
