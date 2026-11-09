export interface CursorQueueEvent {
	attachmentNames: string[];
	editor: "cursor";
	editorTaskId: string;
	generationId: string | null;
	kind: "prompt" | "response" | "session_end";
	occurredAt: string;
	reason: string | null;
	text: string | null;
}

function cursorKind(
	hookEventName: string
): "prompt" | "response" | "session_end" | null {
	switch (hookEventName) {
		case "beforeSubmitPrompt":
			return "prompt";
		case "afterAgentResponse":
			return "response";
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
	return {
		editor: "cursor",
		editorTaskId: conversationId,
		kind,
		generationId:
			typeof record.generation_id === "string" ? record.generation_id : null,
		text: promptText(record),
		reason: typeof record.reason === "string" ? record.reason : null,
		occurredAt:
			typeof record.timestamp === "string"
				? record.timestamp
				: new Date().toISOString(),
		attachmentNames: attachments
			.map((item) => {
				if (!item || typeof item !== "object") {
					return null;
				}
				const filePath = (item as { file_path?: unknown }).file_path;
				return typeof filePath === "string" ? basename(filePath) : null;
			})
			.filter((name): name is string => Boolean(name)),
	};
}

export function ingestBodyFromCursor(
	event: CursorQueueEvent,
	workspaceHash: string
) {
	return {
		editor: event.editor,
		editorTaskId: event.editorTaskId,
		workspaceHash,
		events: [
			{
				idempotencyKey: `cursor:${event.editorTaskId}:${event.kind}:${event.generationId ?? "none"}`,
				kind: event.kind,
				occurredAt: event.occurredAt,
				generationId: event.generationId,
				text: event.text ?? undefined,
				attachmentNames: event.attachmentNames,
				reason: event.reason ?? undefined,
			},
		],
	};
}
