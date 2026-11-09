import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { RunWithDb } from "../lib/db/rls";
import { evidenceRow, testRunRow } from "../lib/db/rows";

const MAX_TOOL_CHARS = 12_000;

function clip<T>(value: T): T {
	const text = JSON.stringify(value);
	if (text.length <= MAX_TOOL_CHARS) {
		return value;
	}
	throw new Error("Tool output exceeded the size budget for this session.");
}

function requireScope(context: {
	requestContext?: {
		get: (key: string) => unknown;
		getRaw?: (key: string) => unknown;
	};
}) {
	const userId = context.requestContext?.get("userId");
	const sessionId = context.requestContext?.get("sessionId");
	const runWithDb =
		context.requestContext?.getRaw?.("runWithDb") ??
		context.requestContext?.get("runWithDb");
	if (
		typeof userId !== "string" ||
		typeof sessionId !== "string" ||
		typeof runWithDb !== "function"
	) {
		throw new Error("Tool authorization context is missing.");
	}
	return {
		userId,
		sessionId,
		runWithDb: runWithDb as RunWithDb,
	};
}

export const getExerciseSnapshotTool = createTool({
	id: "get-exercise-snapshot",
	description:
		"Read the immutable exercise snapshot for the current authorized session only. Do not pass owner IDs.",
	inputSchema: z.object({
		includeTests: z.boolean().optional(),
	}),
	outputSchema: z.object({
		exerciseId: z.string(),
		contentHash: z.string(),
		specMarkdown: z.string(),
		testsSource: z.string().optional(),
		meta: z.unknown(),
	}),
	execute: async (inputData, context) => {
		const { userId, sessionId, runWithDb } = requireScope(context);
		const data = await runWithDb({ role: "authenticated", userId }, (db) =>
			db.exerciseSnapshot.findFirst({
				where: { sessionId, userId },
			})
		);
		if (!data) {
			throw new Error("Snapshot is not available for this session.");
		}
		return clip({
			exerciseId: data.exerciseId,
			contentHash: data.contentHash,
			specMarkdown: data.specMarkdown,
			testsSource: inputData.includeTests ? data.testsSource : undefined,
			meta: data.meta,
		});
	},
});

export const getSessionEvidenceTool = createTool({
	id: "get-session-evidence",
	description:
		"Read ordered evidence for the current authorized session only. Ignores any model-supplied session or owner IDs.",
	inputSchema: z.object({
		kinds: z.array(z.string()).optional(),
		limit: z.number().int().min(1).max(50).optional(),
	}),
	outputSchema: z.object({
		events: z.array(
			z.object({
				id: z.string(),
				seq: z.number(),
				kind: z.string(),
				source: z.string(),
				observationType: z.string(),
				payload: z.unknown(),
				createdAt: z.string(),
			})
		),
	}),
	execute: async (inputData, context) => {
		const { userId, sessionId, runWithDb } = requireScope(context);
		const data = await runWithDb({ role: "authenticated", userId }, (db) =>
			db.evidenceEvent.findMany({
				where: {
					sessionId,
					userId,
					...(inputData.kinds?.length ? { kind: { in: inputData.kinds } } : {}),
				},
				orderBy: { seq: "asc" },
				take: inputData.limit ?? 40,
			})
		);
		return clip({
			events: data.map(evidenceRow),
		});
	},
});

export const getLatestTestRunTool = createTool({
	id: "get-latest-test-run",
	description:
		"Read the latest browser-harness test run for the current session. Results are browser observations, not independent server verification.",
	inputSchema: z.object({}),
	outputSchema: z.object({
		found: z.boolean(),
		run: z.unknown(),
	}),
	execute: async (_inputData, context) => {
		const { userId, sessionId, runWithDb } = requireScope(context);
		const data = await runWithDb({ role: "authenticated", userId }, (db) =>
			db.testRun.findFirst({
				where: { sessionId, userId },
				orderBy: { createdAt: "desc" },
			})
		);
		if (!data) {
			return { found: false, run: null };
		}
		return clip({
			found: true,
			run: testRunRow(data),
		});
	},
});

export const getCaptureEvidenceTool = createTool({
	id: "get-capture-evidence",
	description:
		"Read ordered capture events for the current authorized editor task only. Ignores any model-supplied task or owner IDs.",
	inputSchema: z.object({
		kinds: z.array(z.string()).optional(),
		limit: z.number().int().min(1).max(50).optional(),
	}),
	outputSchema: z.object({
		events: z.array(
			z.object({
				id: z.string(),
				kind: z.string(),
				occurredAt: z.string(),
				payload: z.unknown(),
			})
		),
	}),
	execute: async (inputData, context) => {
		const { userId, sessionId, runWithDb } = requireScope(context);
		const data = await runWithDb({ role: "authenticated", userId }, (db) =>
			db.captureEvent.findMany({
				orderBy: { occurredAt: "asc" },
				take: inputData.limit ?? 40,
				where: {
					taskId: sessionId,
					userId,
					...(inputData.kinds?.length ? { kind: { in: inputData.kinds } } : {}),
				},
			})
		);
		return clip({
			events: data.map((event) => ({
				id: event.id,
				kind: event.kind,
				occurredAt: event.occurredAt.toISOString(),
				payload: event.payload,
			})),
		});
	},
});

export const getCaptureUsageTool = createTool({
	id: "get-capture-usage",
	description:
		"Read stored capture usage rows for the current authorized editor task only. Do not invent token counts.",
	inputSchema: z.object({}),
	outputSchema: z.object({
		rows: z.array(
			z.object({
				cachedTokens: z.number().nullable(),
				inputTokens: z.number().nullable(),
				outputTokens: z.number().nullable(),
				provenance: z.string(),
				reasoningTokens: z.number().nullable(),
				source: z.string(),
			})
		),
	}),
	execute: async (_inputData, context) => {
		const { userId, sessionId, runWithDb } = requireScope(context);
		const data = await runWithDb({ role: "authenticated", userId }, (db) =>
			db.captureUsage.findMany({
				where: { taskId: sessionId, userId },
			})
		);
		return clip({
			rows: data.map((row) => ({
				cachedTokens:
					row.cachedTokens === null ? null : Number(row.cachedTokens),
				inputTokens: row.inputTokens === null ? null : Number(row.inputTokens),
				outputTokens:
					row.outputTokens === null ? null : Number(row.outputTokens),
				provenance: row.provenance,
				reasoningTokens:
					row.reasoningTokens === null ? null : Number(row.reasoningTokens),
				source: row.source,
			})),
		});
	},
});

export const trainerTools = {
	"get-exercise-snapshot": getExerciseSnapshotTool,
	"get-latest-test-run": getLatestTestRunTool,
};

export const reviewTools = {
	"get-exercise-snapshot": getExerciseSnapshotTool,
	"get-session-evidence": getSessionEvidenceTool,
	"get-latest-test-run": getLatestTestRunTool,
};

export const captureReviewTools = {
	"get-capture-evidence": getCaptureEvidenceTool,
	"get-capture-usage": getCaptureUsageTool,
};
