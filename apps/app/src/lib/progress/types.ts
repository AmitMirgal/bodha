export type TokenCoverage = "complete" | "partial" | "unknown";

export type TokenLabel = "measured" | "missing";

export interface ProgressUsage {
	cachedTokens: number | null;
	coverage: TokenCoverage;
	inputTokens: number | null;
	label: TokenLabel;
	outputTokens: number | null;
}

export interface ProgressSuggestion {
	illustrative: boolean;
	improvedExample: string;
	title: string;
	whyItHelps: string;
}

export interface ProgressTask {
	exerciseId: string;
	occurredAt: string;
	outcome: {
		observed: string;
		verification: string;
		verificationProvenance: string;
	} | null;
	prompts: string[];
	reportHref: string;
	reportStatus: "none" | "complete" | "pending" | "error";
	sessionId: string;
	source: "trainer";
	status: string;
	suggestions: ProgressSuggestion[];
	tests: {
		failed: number | null;
		found: boolean;
		passed: number | null;
		total: number | null;
	} | null;
	usage: ProgressUsage;
}

export interface ProgressDay {
	date: string;
	tasks: ProgressTask[];
}

export interface ProgressTrendPoint {
	date: string;
	measuredInputTokens: number | null;
	measuredOutputTokens: number | null;
	measuredTaskCount: number;
	taskCount: number;
}

export interface ProgressView {
	days: ProgressDay[];
	timezone: string;
	trend: ProgressTrendPoint[];
}

export interface ProgressSessionInput {
	createdAt: string;
	exerciseId: string;
	finishedAt: string | null;
	id: string;
	prompts: string[];
	report: { body: unknown; status: string } | null;
	startedAt: string | null;
	status: string;
	usageRows: Array<{
		agent_role: string;
		cached_included_in_input: boolean | null;
		cached_tokens: number | null;
		coverage: string;
		input_tokens: number | null;
		native: unknown;
		output_tokens: number | null;
	}>;
}
