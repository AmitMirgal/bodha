export interface CursorHookPayload {
	contextTokens: number | null;
	contextUsagePercent: number | null;
	contextWindowSize: number | null;
	conversationId: string;
	editCount: number | null;
	filePath: string | null;
	generationId: string | null;
	hookEventName: string;
	prompt: string | null;
	reason: string | null;
	responseText: string | null;
	trigger: "auto" | "manual" | "unknown" | null;
}

const PATH_SEP = /[/\\]/;

function basename(filePath: string): string {
	return filePath.split(PATH_SEP).at(-1) || filePath;
}

export function parseCursorHook(raw: unknown): CursorHookPayload | null {
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
	const edits = Array.isArray(record.edits) ? record.edits : [];
	let trigger: CursorHookPayload["trigger"] = null;
	if (
		record.trigger === "auto" ||
		record.trigger === "manual" ||
		record.trigger === "unknown"
	) {
		trigger = record.trigger;
	}
	return {
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
		conversationId,
		editCount: edits.length,
		filePath:
			typeof record.file_path === "string" ? basename(record.file_path) : null,
		generationId:
			typeof record.generation_id === "string" ? record.generation_id : null,
		hookEventName,
		prompt: typeof record.prompt === "string" ? record.prompt : null,
		reason: typeof record.reason === "string" ? record.reason : null,
		responseText: typeof record.text === "string" ? record.text : null,
		trigger,
	};
}

export function cursorKind(
	hookEventName: string
):
	| "context_compact"
	| "file_edit"
	| "prompt"
	| "response"
	| "session_end"
	| null {
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
