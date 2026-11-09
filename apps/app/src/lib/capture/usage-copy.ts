function sumKnown(values: Array<number | null>): number | null {
	const known = values.filter((value): value is number => value !== null);
	if (known.length === 0) {
		return null;
	}
	return known.reduce((sum, value) => sum + value, 0);
}

export interface CaptureUsageView {
	cachedTokens: number | null;
	inputTokens: number | null;
	outputTokens: number | null;
	provenance: string;
	reasoningTokens?: number | null;
	source: string;
}

function tokenPart(
	label: string,
	value: number | null | undefined
): string | null {
	return value === null || value === undefined
		? null
		: `${label} ${String(value)}`;
}

function missingMeasuredFields(row: CaptureUsageView): string[] {
	const missing: string[] = [];
	if (row.inputTokens === null) {
		missing.push("input");
	}
	if (row.outputTokens === null) {
		missing.push("output");
	}
	if (row.cachedTokens === null) {
		missing.push("cached");
	}
	if (row.reasoningTokens === null || row.reasoningTokens === undefined) {
		missing.push("reasoning");
	}
	return missing;
}

export function preferredUsage(
	rows: CaptureUsageView[]
): CaptureUsageView | null {
	const measured = rows.filter((row) => row.provenance === "measured");
	if (measured[0]) {
		return measured[0];
	}
	const estimated = rows.filter((row) => row.provenance === "estimated");
	if (estimated.length > 0) {
		return {
			cachedTokens: null,
			inputTokens: sumKnown(estimated.map((row) => row.inputTokens)),
			outputTokens: sumKnown(estimated.map((row) => row.outputTokens)),
			provenance: "estimated",
			reasoningTokens: null,
			source: "text_estimate",
		};
	}
	return rows.find((row) => row.provenance === "missing") ?? null;
}

export function usageCopy(
	row: CaptureUsageView | null,
	editor = "this editor"
): string {
	if (!row || row.provenance === "missing") {
		return `Token counts were not available from ${editor} for this task. Totals are omitted, not guessed.`;
	}
	if (row.provenance === "estimated") {
		const parts = [
			tokenPart("input", row.inputTokens),
			tokenPart("output", row.outputTokens),
		].filter((part): part is string => part !== null);
		const counts = parts.length > 0 ? parts.join(", ") : "no countable text";
		return `Estimated from text length (${row.source}): ${counts}. Not vendor-reported. Do not compare with measured totals. This undercounts.`;
	}
	if (row.provenance === "measured") {
		const parts = [
			tokenPart("input", row.inputTokens),
			tokenPart("output", row.outputTokens),
			tokenPart("cached", row.cachedTokens),
			tokenPart("reasoning", row.reasoningTokens ?? null),
		].filter((part): part is string => part !== null);
		const missing = missingMeasuredFields(row);
		const counts = parts.length > 0 ? parts.join(", ") : "no countable fields";
		if (missing.length > 0) {
			return `Partial vendor report. Reported by ${row.source}: ${counts}. Missing ${missing.join(", ")}.`;
		}
		return `Reported by ${row.source}: ${counts}.`;
	}
	return `Token counts were not available from ${editor} for this task. Totals are omitted, not guessed.`;
}
