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

export type ProgressOrigin = "trainer" | "cursor" | "copilot";

export interface ProgressPromptTurn {
	occurredAt: string | null;
	text: string;
	usage: ProgressUsage;
}

export interface ProgressResponseTurn {
	occurredAt: string;
	text: string;
}

export interface ProgressTask {
	coachingSummary: string | null;
	exerciseId: string;
	filePaths: string[];
	needsKey: boolean;
	occurredAt: string;
	origin: ProgressOrigin;
	outcome: {
		observed: string;
		verification: string;
		verificationProvenance: string;
	} | null;
	prompts: string[];
	promptTurns: ProgressPromptTurn[];
	reportError: string | null;
	reportHref: string;
	reportStatus: "none" | "complete" | "pending" | "error";
	responses: ProgressResponseTurn[];
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

export interface ProgressTokenTotals {
	cachedTokens: number | null;
	inputTokens: number | null;
	outputTokens: number | null;
	taskCount: number;
}

export interface ProgressSummary {
	completedCount: number;
	estimated: ProgressTokenTotals | null;
	measured: ProgressTokenTotals | null;
	missingTaskCount: number;
	promptCount: number;
	taskCount: number;
	tests: {
		failed: number;
		passed: number;
		taskCount: number;
		total: number;
	} | null;
}

export interface ProgressChartPoint {
	date: string;
	estimatedInputTokens: number | null;
	estimatedOutputTokens: number | null;
	measuredCachedTokens: number | null;
	measuredInputTokens: number | null;
	measuredOutputTokens: number | null;
	promptCount: number;
	taskCount: number;
}

export interface ProgressView {
	chart: ProgressChartPoint[];
	days: ProgressDay[];
	editor: ProgressSection;
	summary: ProgressSummary;
	tasks: ProgressTask[];
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
	storedReport?: { body: unknown; error: string | null; status: string } | null;
	usage: Array<{
		cachedTokens: number | null;
		inputTokens: number | null;
		outputTokens: number | null;
		provenance: string;
		reasoningTokens?: number | null;
		source: string;
	}>;
}
