import { z } from "zod";

export const editorSchema = z.enum(["cursor", "vscode"]);

export const consentSchema = z.object({
	version: z.literal(1),
	grantedAt: z.string().datetime(),
	scopes: z
		.array(
			z.enum([
				"prompt_text",
				"response_text",
				"file_edit_paths",
				"usage",
				"context_size",
			])
		)
		.min(1)
		.max(8),
});

export const ingestEventSchema = z.object({
	idempotencyKey: z.string().min(1).max(300),
	kind: z.enum(["prompt", "response", "session_end"]),
	occurredAt: z.string().datetime(),
	generationId: z.string().max(200).nullable().optional(),
	text: z.string().max(32_768).optional(),
	attachmentNames: z.array(z.string().max(200)).max(20).optional(),
	reason: z.string().max(80).optional(),
});

export const ingestBatchSchema = z.object({
	editor: editorSchema,
	editorTaskId: z.string().min(1).max(200),
	workspaceHash: z.string().min(1).max(128),
	events: z.array(ingestEventSchema).min(1).max(100),
});

export type IngestBatch = z.infer<typeof ingestBatchSchema>;
export type ConsentInput = z.infer<typeof consentSchema>;
