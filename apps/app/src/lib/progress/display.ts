import type {
	ProgressChartPoint,
	ProgressOrigin,
	ProgressTask,
	ProgressUsage,
} from "./types";

export type SourceFilter = "all" | ProgressOrigin;
export type SortKey = "date" | "outcome" | "prompts" | "source" | "tokens";

export interface TokenMeterSegment {
	color: string;
	key: "cached" | "input" | "output";
	pct: number;
	value: number;
}

export function originLabel(origin: ProgressOrigin): string {
	switch (origin) {
		case "copilot":
			return "Copilot";
		case "cursor":
			return "Cursor";
		case "trainer":
			return "Trainer";
		default: {
			const exhaustive: never = origin;
			throw new Error(`Unhandled origin: ${String(exhaustive)}`);
		}
	}
}

export function provenanceLabel(label: ProgressUsage["label"]): string {
	switch (label) {
		case "estimated":
			return "Estimated";
		case "measured":
			return "Measured";
		case "missing":
			return "Not reported";
		default: {
			const exhaustive: never = label;
			throw new Error(`Unhandled token label: ${String(exhaustive)}`);
		}
	}
}

export function tokenAmount(value: number | null): string {
	return value == null ? "—" : String(value);
}

export function tokenCell(usage: ProgressUsage): string {
	if (usage.label === "missing") {
		return "Not reported";
	}
	const input = tokenAmount(usage.inputTokens);
	const output = tokenAmount(usage.outputTokens);
	if (usage.label === "estimated") {
		return `${input} in / ${output} out`;
	}
	const cached =
		usage.cachedTokens == null
			? "cached not reported"
			: `${usage.cachedTokens} cached`;
	return `${input} in / ${output} out / ${cached}`;
}

export function tokenMeterSegments(
	usage: ProgressUsage
): TokenMeterSegment[] | null {
	if (usage.label === "missing") {
		return null;
	}
	const parts: Array<{
		color: string;
		key: TokenMeterSegment["key"];
		value: number;
	}> = [];
	if (usage.inputTokens != null) {
		parts.push({
			color: "var(--chart-1)",
			key: "input",
			value: usage.inputTokens,
		});
	}
	if (usage.outputTokens != null) {
		parts.push({
			color: "var(--chart-2)",
			key: "output",
			value: usage.outputTokens,
		});
	}
	if (usage.label === "measured" && usage.cachedTokens != null) {
		parts.push({
			color: "var(--chart-3)",
			key: "cached",
			value: usage.cachedTokens,
		});
	}
	if (parts.length === 0) {
		return null;
	}
	const total = parts.reduce((sum, part) => sum + part.value, 0);
	if (total <= 0) {
		const pct = 100 / parts.length;
		return parts.map((part) => ({ ...part, pct }));
	}
	return parts.map((part) => ({
		...part,
		pct: (part.value / total) * 100,
	}));
}

export function knownMeasuredTotal(point: ProgressChartPoint): number | null {
	if (
		point.measuredCachedTokens == null &&
		point.measuredInputTokens == null &&
		point.measuredOutputTokens == null
	) {
		return null;
	}
	return (
		(point.measuredInputTokens ?? 0) +
		(point.measuredOutputTokens ?? 0) +
		(point.measuredCachedTokens ?? 0)
	);
}

export function deltaLabel(delta: number, prior: string): string {
	if (delta === 0) {
		return `Unchanged vs prior ${prior}`;
	}
	if (delta > 0) {
		return `+${String(delta)} vs prior ${prior}`;
	}
	return `${String(delta)} vs prior ${prior}`;
}

export function measuredDelta(
	points: ProgressChartPoint[]
): { current: number; delta: number } | null {
	const totals = points
		.map(knownMeasuredTotal)
		.filter((value): value is number => value != null);
	if (totals.length < 2) {
		return null;
	}
	const current = totals.at(-1);
	const previous = totals.at(-2);
	if (current === undefined || previous === undefined) {
		return null;
	}
	return { current, delta: current - previous };
}

export function promptDelta(
	points: ProgressChartPoint[]
): { current: number; delta: number } | null {
	if (points.length < 2) {
		return null;
	}
	const current = points.at(-1)?.promptCount;
	const previous = points.at(-2)?.promptCount;
	if (current === undefined || previous === undefined) {
		return null;
	}
	return { current, delta: current - previous };
}

export function filterTasks(
	tasks: ProgressTask[],
	filter: SourceFilter
): ProgressTask[] {
	if (filter === "all") {
		return tasks;
	}
	return tasks.filter((task) => task.origin === filter);
}

export function compareTasks(
	left: ProgressTask,
	right: ProgressTask,
	sort: SortKey
): number {
	switch (sort) {
		case "date":
			return right.occurredAt.localeCompare(left.occurredAt);
		case "outcome":
			return (left.outcome?.observed ?? left.status).localeCompare(
				right.outcome?.observed ?? right.status
			);
		case "prompts":
			return right.prompts.length - left.prompts.length;
		case "source":
			return originLabel(left.origin).localeCompare(originLabel(right.origin));
		case "tokens": {
			const leftScore =
				left.usage.label === "missing"
					? -1
					: (left.usage.inputTokens ?? 0) + (left.usage.outputTokens ?? 0);
			const rightScore =
				right.usage.label === "missing"
					? -1
					: (right.usage.inputTokens ?? 0) + (right.usage.outputTokens ?? 0);
			return rightScore - leftScore;
		}
		default: {
			const exhaustive: never = sort;
			throw new Error(`Unhandled sort: ${String(exhaustive)}`);
		}
	}
}

export function parseSourceFilter(value: string): SourceFilter {
	switch (value) {
		case "all":
		case "copilot":
		case "cursor":
		case "trainer":
			return value;
		default:
			return "all";
	}
}

export function parseSortKey(value: string): SortKey {
	switch (value) {
		case "date":
		case "outcome":
		case "prompts":
		case "source":
		case "tokens":
			return value;
		default:
			return "date";
	}
}

export function formatChartDay(value: string): string {
	const date = new Date(`${value}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime())) {
		return value;
	}
	return date.toLocaleDateString("en-US", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
}

export function emptyMessage(filter: SourceFilter): string {
	switch (filter) {
		case "all":
			return "No tasks yet. Finish a trainer exercise or claim an editor device from Settings.";
		case "copilot":
			return "No claimed Copilot tasks yet. Claim a device from Settings after a Copilot session.";
		case "cursor":
			return "No claimed Cursor tasks yet. Claim a device from Settings to see editor prompts here.";
		case "trainer":
			return "No trainer tasks yet. Finish an exercise to see prompts, tokens, and coaching here.";
		default: {
			const exhaustive: never = filter;
			throw new Error(`Unhandled filter: ${String(exhaustive)}`);
		}
	}
}
