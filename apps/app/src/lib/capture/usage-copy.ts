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
	source: string;
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
			source: "text_estimate",
		};
	}
	return rows.find((row) => row.provenance === "missing") ?? null;
}

export function usageCopy(row: CaptureUsageView | null): string {
	if (!row || row.provenance === "missing") {
		return "Token counts were not available from Cursor for this task. Totals are omitted, not guessed.";
	}
	if (row.provenance === "estimated") {
		const parts = [
			row.inputTokens === null ? null : `input ${String(row.inputTokens)}`,
			row.outputTokens === null ? null : `output ${String(row.outputTokens)}`,
		].filter((part): part is string => part !== null);
		const counts = parts.length > 0 ? parts.join(", ") : "no countable text";
		return `Estimated from text length (${row.source}): ${counts}. Not vendor-reported. Do not compare with measured totals. This undercounts.`;
	}
	if (row.provenance === "measured") {
		return `Reported by ${row.source}: input ${String(row.inputTokens)}, output ${String(row.outputTokens)}, cached ${String(row.cachedTokens)}.`;
	}
	return "Token counts were not available from Cursor for this task. Totals are omitted, not guessed.";
}
