export type UsageCoverage = "complete" | "partial" | "unknown";

export interface NormalizedUsage {
	cachedIncludedInInput: boolean | null;
	cachedTokens: number | null;
	coverage: UsageCoverage;
	inputTokens: number | null;
	native: Record<string, unknown> | null;
	outputTokens: number | null;
}

const asFiniteNumber = (value: unknown): number | null => {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (
		typeof value === "string" &&
		value.trim() !== "" &&
		Number.isFinite(Number(value))
	) {
		return Number(value);
	}
	return null;
};

const pick = (
	source: Record<string, unknown>,
	keys: string[],
): number | null => {
	for (const key of keys) {
		if (key in source) {
			const value = asFiniteNumber(source[key]);
			if (value !== null) {
				return value;
			}
		}
	}
	return null;
};

export function normalizeUsage(raw: unknown): NormalizedUsage {
	if (!raw || typeof raw !== "object") {
		return {
			inputTokens: null,
			outputTokens: null,
			cachedTokens: null,
			cachedIncludedInInput: null,
			coverage: "unknown",
			native: null,
		};
	}

	const source = raw as Record<string, unknown>;
	const nested =
		source.usage && typeof source.usage === "object"
			? (source.usage as Record<string, unknown>)
			: source;

	const inputTokens = pick(nested, [
		"inputTokens",
		"promptTokens",
		"prompt_tokens",
		"input_tokens",
	]);
	const outputTokens = pick(nested, [
		"outputTokens",
		"completionTokens",
		"completion_tokens",
		"output_tokens",
	]);
	const cachedTokens = pick(nested, [
		"cachedInputTokens",
		"cacheReadInputTokens",
		"prompt_tokens_details.cached_tokens",
		"cached_tokens",
		"cache_read_input_tokens",
	]);

	let cachedFromDetails: number | null = null;
	const details = nested.prompt_tokens_details;
	if (details && typeof details === "object") {
		cachedFromDetails = asFiniteNumber(
			(details as Record<string, unknown>).cached_tokens,
		);
	}

	const cached = cachedTokens ?? cachedFromDetails;
	const cachedIncludedInInput =
		cached !== null && inputTokens !== null ? cached <= inputTokens : null;

	const hasAny =
		inputTokens !== null || outputTokens !== null || cached !== null;
	let coverage: UsageCoverage = "unknown";
	if (inputTokens !== null && outputTokens !== null) {
		coverage = "complete";
	} else if (hasAny) {
		coverage = "partial";
	}

	const native: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(nested)) {
		if (
			value === null ||
			typeof value === "number" ||
			typeof value === "boolean" ||
			typeof value === "string"
		) {
			native[key] = value;
		}
	}

	return {
		inputTokens,
		outputTokens,
		cachedTokens: cached,
		cachedIncludedInInput,
		coverage,
		native: Object.keys(native).length ? native : null,
	};
}

export function aggregateUsage(records: NormalizedUsage[]): {
	inputTokens: number | null;
	outputTokens: number | null;
	cachedTokens: number | null;
	coverage: UsageCoverage;
	incomplete: boolean;
} {
	if (records.length === 0) {
		return {
			inputTokens: null,
			outputTokens: null,
			cachedTokens: null,
			coverage: "unknown",
			incomplete: true,
		};
	}

	const hasUnknown = records.some((record) => record.coverage === "unknown");
	const hasPartial = records.some((record) => record.coverage === "partial");
	const sum = (select: (record: NormalizedUsage) => number | null) => {
		if (records.some((record) => select(record) === null)) {
			return null;
		}
		return records.reduce((total, record) => total + (select(record) ?? 0), 0);
	};

	let coverage: UsageCoverage = "complete";
	if (hasUnknown && records.every((record) => record.coverage === "unknown")) {
		coverage = "unknown";
	} else if (hasUnknown || hasPartial) {
		coverage = "partial";
	}

	return {
		inputTokens: sum((record) => record.inputTokens),
		outputTokens: sum((record) => record.outputTokens),
		cachedTokens: sum((record) => record.cachedTokens),
		coverage,
		incomplete: coverage !== "complete",
	};
}
