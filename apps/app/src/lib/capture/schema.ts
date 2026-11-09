import { z } from "zod";

export const editorSchema = z.enum(["cursor", "vscode"]);

export const consentSchema = z.object({
	grantedAt: z.string().datetime(),
	scopes: z
		.array(
			z.enum([
				"context_size",
				"file_edit_paths",
				"prompt_text",
				"response_text",
				"usage",
			])
		)
		.min(1)
		.max(8),
	version: z.literal(1),
});

export const ingestEventSchema = z.object({
	attachmentNames: z.array(z.string().max(200)).max(20).optional(),
	cachedTokens: z.number().int().nonnegative().nullable().optional(),
	contextTokens: z.number().int().nonnegative().optional(),
	contextUsagePercent: z.number().nonnegative().optional(),
	contextWindowSize: z.number().int().nonnegative().optional(),
	editCount: z.number().int().nonnegative().optional(),
	generationId: z.string().max(200).nullable().optional(),
	idempotencyKey: z.string().min(1).max(300),
	inputTokens: z.number().int().nonnegative().nullable().optional(),
	kind: z.enum([
		"context_compact",
		"file_edit",
		"prompt",
		"response",
		"session_end",
		"usage",
	]),
	model: z.string().max(200).nullable().optional(),
	occurredAt: z.string().datetime(),
	operationId: z.string().max(200).optional(),
	outputTokens: z.number().int().nonnegative().nullable().optional(),
	path: z.string().max(500).optional(),
	provenance: z.enum(["estimated", "measured", "missing"]).optional(),
	reasoningTokens: z.number().int().nonnegative().nullable().optional(),
	reason: z.string().max(80).optional(),
	source: z
		.enum([
			"copilot_otel_chat_span",
			"cursor_admin_api",
			"none",
			"text_estimate",
		])
		.optional(),
	text: z.string().max(32_768).optional(),
	trigger: z.enum(["auto", "manual", "unknown"]).optional(),
});

export const ingestBatchSchema = z.object({
	editor: editorSchema,
	editorTaskId: z.string().min(1).max(200),
	events: z.array(ingestEventSchema).min(1).max(100),
	workspaceHash: z.string().min(1).max(128),
});

export type ConsentInput = z.infer<typeof consentSchema>;
export type IngestBatch = z.infer<typeof ingestBatchSchema>;
