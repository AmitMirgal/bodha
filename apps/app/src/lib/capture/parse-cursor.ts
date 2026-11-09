export interface CursorHookPayload {
	conversationId: string;
	generationId: string | null;
	hookEventName: string;
	prompt: string | null;
	reason: string | null;
	responseText: string | null;
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
	return {
		conversationId,
		generationId:
			typeof record.generation_id === "string" ? record.generation_id : null,
		hookEventName,
		prompt: typeof record.prompt === "string" ? record.prompt : null,
		responseText: typeof record.text === "string" ? record.text : null,
		reason: typeof record.reason === "string" ? record.reason : null,
	};
}

export function cursorKind(
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
