export type TokenCoverage = "complete" | "partial" | "unknown";

export type TokenLabel = "measured" | "estimated" | "missing";

export interface ProgressUsage {
	cachedTokens: number | null;
	coverage: TokenCoverage;
	inputTokens: number | null;
	label: TokenLabel;
	outputTokens: number | null;
	reasoningTokens?: number | null;
	source?: string;
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
	source: "trainer" | "editor";
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

export interface ProgressSection {
	days: ProgressDay[];
	trend: ProgressTrendPoint[];
}

export interface ProgressView {
	days: ProgressDay[];
	editor: ProgressSection;
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

export interface ProgressEditorInput {
	deviceId: string;
	editor: string;
	editorTaskId: string;
	events: Array<{
		id: string;
		kind: string;
		occurredAt: string;
		payload: unknown;
	}>;
	finishedAt: string | null;
	id: string;
	prompts: string[];
	startedAt: string;
	status: string;
	usage: Array<{
		cachedTokens: number | null;
		inputTokens: number | null;
		outputTokens: number | null;
		provenance: string;
		reasoningTokens?: number | null;
		source: string;
	}>;
}
