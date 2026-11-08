import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

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
	const supabase =
		context.requestContext?.getRaw?.("supabase") ??
		context.requestContext?.get("supabase");
	if (
		typeof userId !== "string" ||
		typeof sessionId !== "string" ||
		!supabase
	) {
		throw new Error("Tool authorization context is missing.");
	}
	return {
		userId,
		sessionId,
		supabase: supabase as SupabaseClient,
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
		const { userId, sessionId, supabase } = requireScope(context);
		const { data, error } = await supabase
			.from("exercise_snapshots")
			.select(
				"exercise_id, content_hash, spec_markdown, tests_source, meta, session_id, user_id",
			)
			.eq("session_id", sessionId)
			.eq("user_id", userId)
			.maybeSingle();
		if (error || !data) {
			throw new Error("Snapshot is not available for this session.");
		}
		return clip({
			exerciseId: data.exercise_id,
			contentHash: data.content_hash,
			specMarkdown: data.spec_markdown,
			testsSource: inputData.includeTests ? data.tests_source : undefined,
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
			}),
		),
	}),
	execute: async (inputData, context) => {
		const { userId, sessionId, supabase } = requireScope(context);
		let query = supabase
			.from("evidence_events")
			.select(
				"id, seq, kind, source, observation_type, payload, created_at, session_id, user_id",
			)
			.eq("session_id", sessionId)
			.eq("user_id", userId)
			.order("seq", { ascending: true })
			.limit(inputData.limit ?? 40);
		if (inputData.kinds?.length) {
			query = query.in("kind", inputData.kinds);
		}
		const { data, error } = await query;
		if (error) {
			throw new Error("Evidence could not be loaded.");
		}
		return clip({
			events: (data ?? []).map((row) => ({
				id: row.id,
				seq: row.seq,
				kind: row.kind,
				source: row.source,
				observationType: row.observation_type,
				payload: row.payload,
				createdAt: row.created_at,
			})),
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
		const { userId, sessionId, supabase } = requireScope(context);
		const { data, error } = await supabase
			.from("test_runs")
			.select(
				"id, results, fatal, provenance, code_revision_hash, created_at, session_id, user_id",
			)
			.eq("session_id", sessionId)
			.eq("user_id", userId)
			.order("created_at", { ascending: false })
			.limit(1)
			.maybeSingle();
		if (error) {
			throw new Error("Test runs could not be loaded.");
		}
		if (!data) {
			return { found: false, run: null };
		}
		return clip({
			found: true,
			run: {
				id: data.id,
				results: data.results,
				fatal: data.fatal,
				provenance: data.provenance,
				codeRevisionHash: data.code_revision_hash,
				createdAt: data.created_at,
			},
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
