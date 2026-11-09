import { cursorKind, parseCursorHook } from "./parse-cursor";
import type { IngestBatch } from "./schema";

const PATH_SEP = /[/\\]/;

function basename(filePath: string): string {
	const parts = filePath.split(PATH_SEP);
	return parts.at(-1) || filePath;
}

function attachmentNames(raw: unknown): string[] {
	if (!raw || typeof raw !== "object") {
		return [];
	}
	const record = raw as Record<string, unknown>;
	if (!Array.isArray(record.attachments)) {
		return [];
	}
	return record.attachments
		.map((item) => {
			if (!item || typeof item !== "object") {
				return null;
			}
			const filePath = (item as { file_path?: unknown }).file_path;
			return typeof filePath === "string" ? basename(filePath) : null;
		})
		.filter((name): name is string => Boolean(name));
}

export function ingestBatchFromCursorHook(
	raw: unknown,
	workspaceHash: string
): IngestBatch | null {
	const parsed = parseCursorHook(raw);
	if (!parsed) {
		return null;
	}
	const kind = cursorKind(parsed.hookEventName);
	if (!kind) {
		return null;
	}
	const stamp =
		typeof (raw as { timestamp?: unknown }).timestamp === "string"
			? (raw as { timestamp: string }).timestamp
			: new Date().toISOString();
	const generationId = parsed.generationId ?? "none";
	return {
		editor: "cursor",
		editorTaskId: parsed.conversationId,
		workspaceHash,
		events: [
			{
				idempotencyKey: `cursor:${parsed.conversationId}:${kind}:${generationId}`,
				kind,
				occurredAt: stamp,
				generationId: parsed.generationId,
				text: parsed.prompt ?? parsed.responseText ?? undefined,
				attachmentNames: attachmentNames(raw),
				reason: parsed.reason ?? undefined,
			},
		],
	};
}
