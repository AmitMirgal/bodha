import { estimateTokensFromText, redactSecrets } from "./redact";

export interface CopilotQueueEvent {
	attachmentNames: string[];
	contextTokens: number | null;
	contextUsagePercent: number | null;
	contextWindowSize: number | null;
	editCount: number | null;
	editor: "vscode";
	editorTaskId: string;
	generationId: string | null;
	kind: "context_compact" | "file_edit" | "prompt" | "response" | "session_end";
	occurredAt: string;
	path: string | null;
	reason: string | null;
	text: string | null;
	trigger: "auto" | "manual" | "unknown" | null;
}

const PATH_SEP = /[/\\]/;

function basename(filePath: string): string {
	const parts = filePath.split(PATH_SEP);
	return parts.at(-1) || filePath;
}

function stringField(
	record: Record<string, unknown>,
	keys: string[]
): string | null {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.length > 0) {
			return value;
		}
	}
	return null;
}

function numberField(
	record: Record<string, unknown>,
	keys: string[]
): number | null {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "number" && Number.isFinite(value)) {
			return value;
		}
	}
	return null;
}

function copilotKind(hookEventName: string): CopilotQueueEvent["kind"] | null {
	switch (hookEventName) {
		case "userPromptSubmitted":
		case "UserPromptSubmit":
			return "prompt";
		case "postToolUse":
		case "PostToolUse":
			return "file_edit";
		case "preCompact":
		case "PreCompact":
			return "context_compact";
		case "sessionEnd":
		case "SessionEnd":
		case "agentStop":
		case "Stop":
			return "session_end";
		default:
			return null;
	}
}

function toolPath(record: Record<string, unknown>): string | null {
	const args = record.toolArgs ?? record.tool_args;
	if (args && typeof args === "object") {
		const fromArgs = stringField(args as Record<string, unknown>, [
			"path",
			"filePath",
			"file_path",
		]);
		if (fromArgs) {
			return basename(fromArgs);
		}
	}
	const direct = stringField(record, ["path", "filePath", "file_path"]);
	return direct ? basename(direct) : null;
}

function isEditTool(record: Record<string, unknown>): boolean {
	const name = stringField(record, ["toolName", "tool_name"]) ?? "";
	const lower = name.toLowerCase();
	return (
		lower.includes("edit") ||
		lower.includes("write") ||
		lower.includes("create") ||
		lower.includes("strreplace") ||
		lower.includes("apply_patch")
	);
}

export function mapCopilotHook(raw: unknown): CopilotQueueEvent | null {
	if (!raw || typeof raw !== "object") {
		return null;
	}
	const record = raw as Record<string, unknown>;
	const editorTaskId = stringField(record, [
		"sessionId",
		"session_id",
		"conversationId",
		"conversation_id",
	]);
	if (!editorTaskId) {
		return null;
	}
	const hookEventName =
		stringField(record, ["hook_event_name", "hookEventName", "eventName"]) ??
		"";
	const kind = copilotKind(hookEventName);
	if (!kind) {
		return null;
	}
	if (kind === "file_edit" && !isEditTool(record)) {
		return null;
	}
	let trigger: CopilotQueueEvent["trigger"] = null;
	if (
		record.trigger === "auto" ||
		record.trigger === "manual" ||
		record.trigger === "unknown"
	) {
		trigger = record.trigger;
	}
	return {
		attachmentNames: [],
		contextTokens: numberField(record, ["contextTokens", "context_tokens"]),
		contextUsagePercent: numberField(record, [
			"contextUsagePercent",
			"context_usage_percent",
		]),
		contextWindowSize: numberField(record, [
			"contextWindowSize",
			"context_window_size",
		]),
		editCount: 1,
		editor: "vscode",
		editorTaskId,
		generationId: stringField(record, ["generationId", "generation_id"]),
		kind,
		occurredAt:
			stringField(record, ["timestamp", "occurredAt"]) ??
			new Date().toISOString(),
		path: toolPath(record),
		reason: stringField(record, ["reason", "status"]),
		text: stringField(record, ["prompt", "text"]),
		trigger,
	};
}

export function ingestBodyFromCopilot(
	event: CopilotQueueEvent,
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
			idempotencyKey: `vscode:${event.editorTaskId}:${event.kind}:${event.generationId ?? event.path ?? "none"}`,
			kind: event.kind,
			occurredAt: event.occurredAt,
			path: event.path ?? undefined,
			reason: event.reason ?? undefined,
			text,
			trigger: event.trigger ?? undefined,
		},
	];
	if (event.kind === "prompt" && text) {
		events.push({
			idempotencyKey: `vscode:${event.editorTaskId}:usage:text_estimate:prompt:${event.generationId ?? "none"}`,
			inputTokens: estimateTokensFromText(text),
			kind: "usage",
			occurredAt: event.occurredAt,
			operationId: `text-estimate:prompt:${event.generationId ?? "none"}`,
			outputTokens: null,
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
