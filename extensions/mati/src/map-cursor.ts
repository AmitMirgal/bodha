import { estimateTokensFromText, redactSecrets } from "./redact";

export interface CursorQueueEvent {
	attachmentNames: string[];
	contextTokens: number | null;
	contextUsagePercent: number | null;
	contextWindowSize: number | null;
	editCount: number | null;
	editor: "cursor";
	editorTaskId: string;
	generationId: string | null;
	kind: "context_compact" | "file_edit" | "prompt" | "response" | "session_end";
	occurredAt: string;
	path: string | null;
	reason: string | null;
	text: string | null;
	trigger: "auto" | "manual" | "unknown" | null;
}

function cursorKind(hookEventName: string): CursorQueueEvent["kind"] | null {
	switch (hookEventName) {
		case "beforeSubmitPrompt":
			return "prompt";
		case "afterAgentResponse":
			return "response";
		case "afterFileEdit":
			return "file_edit";
		case "preCompact":
			return "context_compact";
		case "sessionEnd":
		case "stop":
			return "session_end";
		default:
			return null;
	}
}

function promptText(record: Record<string, unknown>): string | null {
	if (typeof record.prompt === "string") {
		return record.prompt;
	}
	if (typeof record.text === "string") {
		return record.text;
	}
	return null;
}

const PATH_SEP = /[/\\]/;

function basename(filePath: string): string {
	const parts = filePath.split(PATH_SEP);
	return parts.at(-1) || filePath;
}

export function mapCursorHook(raw: unknown): CursorQueueEvent | null {
	if (!raw || typeof raw !== "object") {
		return null;
	}
	const record = raw as Record<string, unknown>;
	let conversationId: string | null = null;
	if (typeof record.conversation_id === "string") {
		conversationId = record.conversation_id;
	} else if (typeof record.session_id === "string") {
		conversationId = record.session_id;
	}
	if (!conversationId) {
		return null;
	}
	const hookEventName =
		typeof record.hook_event_name === "string" ? record.hook_event_name : "";
	const kind = cursorKind(hookEventName);
	if (!kind) {
		return null;
	}
	const attachments = Array.isArray(record.attachments)
		? record.attachments
		: [];
	const edits = Array.isArray(record.edits) ? record.edits : [];
	let trigger: CursorQueueEvent["trigger"] = null;
	if (
		record.trigger === "auto" ||
		record.trigger === "manual" ||
		record.trigger === "unknown"
	) {
		trigger = record.trigger;
	}
	return {
		attachmentNames: attachments
			.map((item) => {
				if (!item || typeof item !== "object") {
					return null;
				}
				const filePath = (item as { file_path?: unknown }).file_path;
				return typeof filePath === "string" ? basename(filePath) : null;
			})
			.filter((name): name is string => Boolean(name)),
		contextTokens:
			typeof record.context_tokens === "number" ? record.context_tokens : null,
		contextUsagePercent:
			typeof record.context_usage_percent === "number"
				? record.context_usage_percent
				: null,
		contextWindowSize:
			typeof record.context_window_size === "number"
				? record.context_window_size
				: null,
		editCount: edits.length,
		editor: "cursor",
		editorTaskId: conversationId,
		generationId:
			typeof record.generation_id === "string" ? record.generation_id : null,
		kind,
		occurredAt:
			typeof record.timestamp === "string"
				? record.timestamp
				: new Date().toISOString(),
		path:
			typeof record.file_path === "string" ? basename(record.file_path) : null,
		reason: typeof record.reason === "string" ? record.reason : null,
		text: promptText(record),
		trigger,
	};
}

export function ingestBodyFromCursor(
	event: CursorQueueEvent,
	workspaceHash: string
) {
	const text = event.text ? redactSecrets(event.text) : undefined;
	const events: Record<string, unknown>[] = [
		{
			attachmentNames: event.attachmentNames,
			contextTokens: event.contextTokens ?? undefined,
			contextUsagePercent: event.contextUsagePercent ?? undefined,
			contextWindowSize: event.contextWindowSize ?? undefined,
			editCount: event.editCount ?? undefined,
			generationId: event.generationId,
			idempotencyKey: `cursor:${event.editorTaskId}:${event.kind}:${event.generationId ?? "none"}`,
			kind: event.kind,
			occurredAt: event.occurredAt,
			path: event.path ?? undefined,
			reason: event.reason ?? undefined,
			text,
			trigger: event.trigger ?? undefined,
		},
	];
	if ((event.kind === "prompt" || event.kind === "response") && text) {
		const tokens = estimateTokensFromText(text);
		events.push({
			idempotencyKey: `cursor:${event.editorTaskId}:usage:text_estimate:${event.kind}:${event.generationId ?? "none"}`,
			inputTokens: event.kind === "prompt" ? tokens : null,
			kind: "usage",
			occurredAt: event.occurredAt,
			operationId: `text-estimate:${event.kind}:${event.generationId ?? "none"}`,
			outputTokens: event.kind === "response" ? tokens : null,
			provenance: "estimated",
			source: "text_estimate",
		});
	}
	return {
		editor: event.editor,
		editorTaskId: event.editorTaskId,
		events,
		workspaceHash,
	};
}
