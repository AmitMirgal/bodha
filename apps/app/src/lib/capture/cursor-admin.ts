export const CURSOR_ADMIN_BINDING = {
	model: "filtered-usage-events",
	provider: "cursor_admin",
} as const;

export const CURSOR_ADMIN_USAGE_URL =
	"https://api.cursor.com/teams/filtered-usage-events";

export interface CursorAdminTokenUsage {
	cachedTokens: number | null;
	conversationId: string;
	inputTokens: number | null;
	outputTokens: number | null;
}

function asToken(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function matchCursorAdminUsage(
	editorTaskId: string,
	payload: unknown
): CursorAdminTokenUsage | null {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const record = payload as { usageEvents?: unknown };
	const events = Array.isArray(record.usageEvents) ? record.usageEvents : [];
	for (const event of events) {
		if (!event || typeof event !== "object") {
			continue;
		}
		const row = event as {
			conversationId?: unknown;
			tokenUsage?: {
				cacheReadTokens?: unknown;
				cacheWriteTokens?: unknown;
				inputTokens?: unknown;
				outputTokens?: unknown;
			};
		};
		if (row.conversationId !== editorTaskId) {
			continue;
		}
		const usage = row.tokenUsage ?? {};
		const cacheRead = asToken(usage.cacheReadTokens);
		const cacheWrite = asToken(usage.cacheWriteTokens);
		const cached =
			cacheRead == null && cacheWrite == null
				? null
				: (cacheRead ?? 0) + (cacheWrite ?? 0);
		return {
			conversationId: editorTaskId,
			inputTokens: asToken(usage.inputTokens),
			outputTokens: asToken(usage.outputTokens),
			cachedTokens: cached,
		};
	}
	return null;
}

export function measuredUsageEvent(
	editorTaskId: string,
	matched: CursorAdminTokenUsage
) {
	return {
		kind: "usage" as const,
		operationId: `cursor-admin:${editorTaskId}`,
		provenance: "measured" as const,
		source: "cursor_admin_api" as const,
		inputTokens: matched.inputTokens,
		outputTokens: matched.outputTokens,
		cachedTokens: matched.cachedTokens,
		reasoningTokens: null,
	};
}
