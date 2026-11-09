import { usageCopy as captureUsageCopy } from "../capture/usage-copy";
import type {
	ProgressChartPoint,
	ProgressSummary,
	ProgressTask,
	ProgressTokenTotals,
	ProgressUsage,
} from "./types";

function dayBucket(iso: string, timeZone: string): string {
	const date = new Date(iso);
	const parts = new Intl.DateTimeFormat("en-CA", {
		day: "2-digit",
		month: "2-digit",
		timeZone,
		year: "numeric",
	}).formatToParts(date);
	const year = parts.find((part) => part.type === "year")?.value;
	const month = parts.find((part) => part.type === "month")?.value;
	const day = parts.find((part) => part.type === "day")?.value;
	return `${year}-${month}-${day}`;
}

function addTokens(
	into: ProgressTokenTotals,
	usage: ProgressUsage
): ProgressTokenTotals {
	return {
		cachedTokens: into.cachedTokens + (usage.cachedTokens ?? 0),
		inputTokens: into.inputTokens + (usage.inputTokens ?? 0),
		outputTokens: into.outputTokens + (usage.outputTokens ?? 0),
		taskCount: into.taskCount + 1,
	};
}

export function summaryFromTasks(tasks: ProgressTask[]): ProgressSummary {
	let measured: ProgressTokenTotals | null = null;
	let estimated: ProgressTokenTotals | null = null;
	let missingTaskCount = 0;
	let testTaskCount = 0;
	let testPassed = 0;
	let testFailed = 0;
	let testTotal = 0;
	for (const task of tasks) {
		switch (task.usage.label) {
			case "measured":
				measured = addTokens(
					measured ?? {
						cachedTokens: 0,
						inputTokens: 0,
						outputTokens: 0,
						taskCount: 0,
					},
					task.usage
				);
				break;
			case "estimated":
				estimated = addTokens(
					estimated ?? {
						cachedTokens: 0,
						inputTokens: 0,
						outputTokens: 0,
						taskCount: 0,
					},
					task.usage
				);
				break;
			case "missing":
				missingTaskCount += 1;
				break;
			default: {
				const exhaustive: never = task.usage.label;
				throw new Error(`Unhandled token label: ${String(exhaustive)}`);
			}
		}
		if (task.tests?.found) {
			testTaskCount += 1;
			testPassed += task.tests.passed ?? 0;
			testFailed += task.tests.failed ?? 0;
			testTotal += task.tests.total ?? 0;
		}
	}
	return {
		completedCount: tasks.filter(
			(task) => task.status === "complete" || task.status === "closed"
		).length,
		estimated,
		measured,
		missingTaskCount,
		promptCount: tasks.reduce((sum, task) => sum + task.prompts.length, 0),
		taskCount: tasks.length,
		tests:
			testTaskCount === 0
				? null
				: {
						failed: testFailed,
						passed: testPassed,
						taskCount: testTaskCount,
						total: testTotal,
					},
	};
}

export function chartFromTasks(
	tasks: ProgressTask[],
	timezone: string
): ProgressChartPoint[] {
	const grouped = new Map<string, ProgressTask[]>();
	for (const task of tasks) {
		const date = dayBucket(task.occurredAt, timezone);
		const list = grouped.get(date) ?? [];
		list.push(task);
		grouped.set(date, list);
	}
	return [...grouped.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([date, dayTasks]) => {
			const measured = dayTasks.filter(
				(task) => task.usage.label === "measured"
			);
			const estimated = dayTasks.filter(
				(task) => task.usage.label === "estimated"
			);
			const measuredInput = measured.reduce(
				(sum, task) => sum + (task.usage.inputTokens ?? 0),
				0
			);
			const measuredOutput = measured.reduce(
				(sum, task) => sum + (task.usage.outputTokens ?? 0),
				0
			);
			const measuredCached = measured.reduce(
				(sum, task) => sum + (task.usage.cachedTokens ?? 0),
				0
			);
			const estimatedInput = estimated.reduce(
				(sum, task) => sum + (task.usage.inputTokens ?? 0),
				0
			);
			const estimatedOutput = estimated.reduce(
				(sum, task) => sum + (task.usage.outputTokens ?? 0),
				0
			);
			return {
				date,
				estimatedInputTokens: estimated.length > 0 ? estimatedInput : null,
				estimatedOutputTokens: estimated.length > 0 ? estimatedOutput : null,
				measuredCachedTokens: measured.length > 0 ? measuredCached : null,
				measuredInputTokens: measured.length > 0 ? measuredInput : null,
				measuredOutputTokens: measured.length > 0 ? measuredOutput : null,
				promptCount: dayTasks.reduce(
					(sum, task) => sum + task.prompts.length,
					0
				),
				taskCount: dayTasks.length,
			};
		});
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
