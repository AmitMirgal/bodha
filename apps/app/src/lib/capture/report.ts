import {
	assembleLearningReport,
	emptyEditorUsage,
	type StoredEvidence,
} from "../reports/assemble";
import type { LearningReport } from "../reports/schema";
import { preferredUsage } from "./usage-copy";

export interface CaptureEventInput {
	id: string;
	kind: string;
	occurredAt: string;
	payload: unknown;
}

export interface CaptureUsageInput {
	cachedTokens: number | null;
	inputTokens: number | null;
	outputTokens: number | null;
	provenance: string;
	reasoningTokens?: number | null;
	source: string;
}

const CITABLE = new Set([
	"prompt",
	"assistant",
	"tool",
	"test_run",
	"system",
	"consent",
	"usage",
	"file_edit",
	"response",
	"session_end",
	"context_compact",
]);

function payloadText(payload: unknown, key: string): string | null {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const value = (payload as Record<string, unknown>)[key];
	return typeof value === "string" && value.trim() ? value : null;
}

export function captureEventsToEvidence(
	events: CaptureEventInput[],
	taskId: string
): StoredEvidence[] {
	return events
		.filter((event) => CITABLE.has(event.kind))
		.map((event) => ({
			id: event.id,
			kind: event.kind,
			payload: event.payload,
			sessionId: taskId,
		}));
}

export function promptsFromCaptureEvents(
	events: CaptureEventInput[]
): string[] {
	return events
		.filter((event) => event.kind === "prompt")
		.map((event) => payloadText(event.payload, "text"))
		.filter((text): text is string => text != null);
}

export function outcomeFromCaptureEvents(
	events: CaptureEventInput[]
): LearningReport["outcome"] {
	const closed = [...events]
		.reverse()
		.find((event) => event.kind === "session_end");
	const reason = payloadText(closed?.payload, "reason") ?? "unknown";
	return {
		observed: closed
			? `Editor task closed (${reason}).`
			: "No sessionEnd was recorded for this editor task.",
		verification:
			"The server did not independently execute editor code. Suggestions below are not a measured result.",
		verificationProvenance: "insufficient_evidence",
	};
}

export function editorUsageFromRows(
	rows: CaptureUsageInput[]
): NonNullable<LearningReport["usage"]["editor"]> {
	const preferred = preferredUsage(rows);
	if (!preferred || preferred.provenance === "missing") {
		return emptyEditorUsage();
	}
	if (preferred.provenance === "estimated") {
		return {
			inputTokens: preferred.inputTokens,
			outputTokens: preferred.outputTokens,
			cachedTokens: null,
			reasoningTokens: null,
			coverage: "partial",
			provenance: "estimated",
			source: preferred.source,
		};
	}
	const missing =
		preferred.inputTokens === null ||
		preferred.outputTokens === null ||
		preferred.cachedTokens === null ||
		preferred.reasoningTokens === null ||
		preferred.reasoningTokens === undefined;
	return {
		inputTokens: preferred.inputTokens,
		outputTokens: preferred.outputTokens,
		cachedTokens: preferred.cachedTokens,
		reasoningTokens: preferred.reasoningTokens ?? null,
		coverage: missing ? "partial" : "complete",
		provenance: "measured",
		source: preferred.source,
	};
}

export function defaultEditorModelReview(
	editorUsage: NonNullable<LearningReport["usage"]["editor"]>
): unknown {
	const notes: string[] = [];
	if (editorUsage.provenance === "estimated") {
		notes.push(
			"Token counts are estimated from text length. They are not vendor-reported."
		);
	}
	if (editorUsage.provenance === "missing") {
		notes.push(
			"Token counts were not available from the editor for this task."
		);
	}
	notes.push("No browser harness run exists for editor capture tasks.");
	return {
		summary:
			"Editor task evidence only. Coaching below is empty until a review model runs.",
		suggestions: [],
		insufficientEvidence: notes,
	};
}

export function assembleEditorLearningReport(input: {
	events: CaptureEventInput[];
	model?: unknown;
	taskId: string;
	usage: CaptureUsageInput[];
}): { ok: true; report: LearningReport } | { ok: false; error: string } {
	const editorUsage = editorUsageFromRows(input.usage);
	const evidence = captureEventsToEvidence(input.events, input.taskId);
	const assembled = assembleLearningReport({
		sessionId: input.taskId,
		model: input.model ?? defaultEditorModelReview(editorUsage),
		evidence,
		usageRows: [],
		editorUsage,
	});
	if (!assembled.ok) {
		return assembled;
	}
	return {
		ok: true,
		report: {
			...assembled.report,
			observations: {
				tests: {
					found: false,
					passed: null,
					failed: null,
					total: null,
					fatal: null,
					provenance: "insufficient_evidence",
				},
			},
			outcome: outcomeFromCaptureEvents(input.events),
		},
	};
}
