import { aggregateUsage, type NormalizedUsage } from "@repo/ai/provider";
import {
	type LearningReport,
	modelReviewSchema,
	reportSchema,
	validateReportAgainstEvidence,
} from "./schema";

export interface StoredEvidence {
	id: string;
	kind: string;
	payload: unknown;
	sessionId: string;
}

export interface StoredUsageRow {
	agent_role: string;
	cached_included_in_input: boolean | null;
	cached_tokens: number | null;
	coverage: string;
	input_tokens: number | null;
	native: unknown;
	output_tokens: number | null;
}

export type MeasuredObservations = LearningReport["observations"];

function testPayload(evidence: StoredEvidence[]) {
	const tests = evidence.filter((item) => item.kind === "test_run");
	const latest = tests.at(-1);
	const payload =
		latest?.payload && typeof latest.payload === "object"
			? (latest.payload as {
					fatal?: string | null;
					results?: { pass?: boolean }[];
				})
			: {};
	const results = Array.isArray(payload.results) ? payload.results : [];
	const passed = results.filter((result) => result.pass === true).length;
	const failed = results.length - passed;
	const fatal =
		typeof payload.fatal === "string" && payload.fatal ? payload.fatal : null;
	return { tests, results, passed, failed, fatal };
}

export function observationsFromEvidence(
	evidence: StoredEvidence[],
): MeasuredObservations {
	const { tests, results, passed, failed, fatal } = testPayload(evidence);
	if (tests.length === 0) {
		return {
			tests: {
				found: false,
				passed: null,
				failed: null,
				total: null,
				fatal: null,
				provenance: "insufficient_evidence",
			},
		};
	}
	return {
		tests: {
			found: true,
			passed,
			failed,
			total: results.length,
			fatal,
			provenance: "browser_harness",
		},
	};
}

export function outcomeFromEvidence(
	evidence: StoredEvidence[],
): LearningReport["outcome"] {
	const observations = observationsFromEvidence(evidence);
	if (!observations.tests.found) {
		return {
			observed: "No browser harness run was recorded for this session.",
			verification:
				"The server did not independently execute learner code. Suggestions below are not a measured result.",
			verificationProvenance: "insufficient_evidence",
		};
	}
	const { passed, failed, total, fatal } = observations.tests;
	return {
		observed: fatal
			? `Latest browser harness run ended with a fatal error after reporting ${total} tests.`
			: `Latest browser harness run observed ${passed} passing and ${failed} failing of ${total} tests.`,
		verification:
			"Results are browser-harness observations, not independent server execution.",
		verificationProvenance: "browser_harness",
	};
}

function coachingText(model: {
	summary: string;
	insufficientEvidence: string[];
	suggestions: { title: string; detail: string; improvedExample: string }[];
}): string {
	return [
		model.summary,
		...model.insufficientEvidence,
		...model.suggestions.flatMap((suggestion) => [
			suggestion.title,
			suggestion.detail,
			suggestion.improvedExample,
		]),
	].join("\n");
}

export function inventedCoachingClaims(
	text: string,
	observations: MeasuredObservations,
): string[] {
	const issues: string[] = [];
	const lower = text.toLowerCase();
	if (
		/\b\d+\s*(input|output|prompt|completion|cached)?\s*tokens?\b/i.test(text)
	) {
		issues.push("Coaching text must not include token counts.");
	}
	const claimedAllPass =
		/all tests passed|every test passed|tests all pass/.test(lower);
	const actuallyAllPass =
		observations.tests.found &&
		observations.tests.fatal === null &&
		observations.tests.total !== null &&
		observations.tests.total > 0 &&
		observations.tests.failed === 0;
	if (claimedAllPass && !actuallyAllPass) {
		issues.push(
			"Summary claimed all tests passed without a matching harness observation.",
		);
	}
	if (/independently verif|server executed|certified pass/.test(lower)) {
		issues.push("Coaching text claimed independent verification.");
	}
	return issues;
}

function toNormalized(row: StoredUsageRow): NormalizedUsage {
	const coverage =
		row.coverage === "complete" ||
		row.coverage === "partial" ||
		row.coverage === "unknown"
			? row.coverage
			: "unknown";
	return {
		inputTokens: row.input_tokens,
		outputTokens: row.output_tokens,
		cachedTokens: row.cached_tokens,
		cachedIncludedInInput: row.cached_included_in_input,
		coverage,
		native:
			row.native && typeof row.native === "object"
				? (row.native as Record<string, unknown>)
				: null,
	};
}

function packRole(rows: StoredUsageRow[]): LearningReport["usage"]["trainer"] {
	if (rows.length === 0) {
		return {
			inputTokens: null,
			outputTokens: null,
			cachedTokens: null,
			coverage: "unknown",
		};
	}
	const aggregate = aggregateUsage(rows.map(toNormalized));
	return {
		inputTokens: aggregate.inputTokens,
		outputTokens: aggregate.outputTokens,
		cachedTokens: aggregate.cachedTokens,
		coverage: aggregate.coverage,
	};
}

export function usageFromStoredRecords(
	rows: StoredUsageRow[],
): LearningReport["usage"] {
	const trainer = packRole(rows.filter((row) => row.agent_role === "trainer"));
	const review = packRole(rows.filter((row) => row.agent_role === "review"));
	return {
		trainer,
		review,
		incomplete:
			trainer.coverage !== "complete" || review.coverage !== "complete",
	};
}

export function parseModelReview(raw: unknown) {
	return modelReviewSchema.safeParse(raw);
}

export function assembleLearningReport(input: {
	evidence: StoredEvidence[];
	model: unknown;
	sessionId: string;
	usageRows: StoredUsageRow[];
}): { ok: true; report: LearningReport } | { ok: false; error: string } {
	const parsed = parseModelReview(input.model);
	if (!parsed.success) {
		return {
			ok: false,
			error: "Review output was not a valid learning report.",
		};
	}
	const observations = observationsFromEvidence(input.evidence);
	const invented = inventedCoachingClaims(
		coachingText(parsed.data),
		observations,
	);
	if (invented.length > 0) {
		return { ok: false, error: invented[0] ?? "Invented coaching claims." };
	}
	const assembled: LearningReport = {
		summary: parsed.data.summary,
		suggestions: parsed.data.suggestions,
		insufficientEvidence: parsed.data.insufficientEvidence,
		observations,
		outcome: outcomeFromEvidence(input.evidence),
		usage: usageFromStoredRecords(input.usageRows),
	};
	const schema = reportSchema.safeParse(assembled);
	if (!schema.success) {
		return { ok: false, error: "Assembled report failed schema validation." };
	}
	return validateReportAgainstEvidence(
		schema.data,
		input.evidence.map((item) => ({
			id: item.id,
			kind: item.kind,
			sessionId: item.sessionId,
		})),
		input.sessionId,
	);
}
