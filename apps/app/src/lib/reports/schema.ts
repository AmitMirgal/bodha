import { z } from "zod";

export const reportCitationSchema = z.object({
	evidenceId: z.string().uuid(),
	kind: z.enum([
		"prompt",
		"assistant",
		"tool",
		"test_run",
		"system",
		"consent",
		"usage",
	]),
	note: z.string().min(1).max(500),
});

export const reportObservationsSchema = z.object({
	tests: z.object({
		failed: z.number().int().nonnegative().nullable(),
		fatal: z.string().nullable(),
		found: z.boolean(),
		passed: z.number().int().nonnegative().nullable(),
		provenance: z.enum(["browser_harness", "insufficient_evidence"]),
		total: z.number().int().nonnegative().nullable(),
	}),
});

export const reportSchema = z.object({
	summary: z.string().min(1).max(2000),
	observations: reportObservationsSchema,
	outcome: z.object({
		observed: z.string().min(1).max(1000),
		verification: z.string().min(1).max(1000),
		verificationProvenance: z.enum([
			"browser_harness",
			"insufficient_evidence",
		]),
	}),
	suggestions: z
		.array(
			z.object({
				title: z.string().min(1).max(160),
				detail: z.string().min(1).max(2000),
				improvedExample: z.string().min(1).max(2000),
				whyItHelps: z.string().min(1).max(1000),
				citations: z.array(reportCitationSchema).min(1),
				illustrative: z.boolean(),
			})
		)
		.max(8),
	usage: z.object({
		trainer: z.object({
			inputTokens: z.number().nullable(),
			outputTokens: z.number().nullable(),
			cachedTokens: z.number().nullable(),
			coverage: z.enum(["complete", "partial", "unknown"]),
		}),
		review: z.object({
			inputTokens: z.number().nullable(),
			outputTokens: z.number().nullable(),
			cachedTokens: z.number().nullable(),
			coverage: z.enum(["complete", "partial", "unknown"]),
		}),
		incomplete: z.boolean(),
	}),
	insufficientEvidence: z.array(z.string()).default([]),
});

export type LearningReport = z.infer<typeof reportSchema>;

export const modelReviewSchema = reportSchema.omit({
	observations: true,
	outcome: true,
	usage: true,
});

export type ModelReview = z.infer<typeof modelReviewSchema>;

export interface EvidenceRef {
	id: string;
	kind: string;
	sessionId: string;
}

export function validateReportAgainstEvidence(
	report: LearningReport,
	evidence: EvidenceRef[],
	sessionId: string
): { ok: true; report: LearningReport } | { ok: false; error: string } {
	const allowed = new Map(evidence.map((item) => [item.id, item]));
	for (const suggestion of report.suggestions) {
		for (const citation of suggestion.citations) {
			const found = allowed.get(citation.evidenceId);
			if (!found) {
				return {
					ok: false,
					error: `Citation ${citation.evidenceId} is not in this session.`,
				};
			}
			if (found.sessionId !== sessionId) {
				return { ok: false, error: "Cross-session citation rejected." };
			}
			if (found.kind !== citation.kind) {
				return {
					ok: false,
					error: `Citation kind mismatch for ${citation.evidenceId}.`,
				};
			}
		}
		if (
			suggestion.illustrative === false &&
			suggestion.citations.length === 0
		) {
			return { ok: false, error: "Factual suggestions must cite evidence." };
		}
	}
	if (
		report.outcome.verificationProvenance === "browser_harness" &&
		!evidence.some((item) => item.kind === "test_run")
	) {
		return {
			ok: false,
			error:
				"Report claimed harness verification without a test-run evidence record.",
		};
	}
	return { ok: true, report };
}
