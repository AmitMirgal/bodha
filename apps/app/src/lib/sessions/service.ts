import type { SupabaseClient } from "@supabase/supabase-js";
import { getChallenge } from "../challenges";
import { insertOnce } from "../db/insert-once";
import { PROGRESS_TIMEZONE } from "../env";
import { PersistenceError, RevisionConflictError } from "../errors";
import { newIdempotencyKey, operationId } from "../idempotency";
import type { TestResult } from "../runner";
import { buildExerciseSnapshot, hashFiles } from "../snapshot";

export type SessionStatus =
	| "pending_consent"
	| "running"
	| "finalizing"
	| "complete"
	| "cancelled"
	| "failed"
	| "incomplete";

export function assertStatus(status: string): SessionStatus {
	switch (status) {
		case "pending_consent":
		case "running":
		case "finalizing":
		case "complete":
		case "cancelled":
		case "failed":
		case "incomplete":
			return status;
		default: {
			const exhaustive: never = status as never;
			throw new Error(`Unknown session status: ${String(exhaustive)}`);
		}
	}
}

export async function insertEvidence(
	supabase: SupabaseClient,
	input: {
		sessionId: string;
		userId: string;
		kind: string;
		source: string;
		observationType: string;
		payload: unknown;
		idempotencyKey: string;
	},
) {
	const result = await insertOnce<{ id: string; seq: number }>(
		supabase,
		"evidence_events",
		{
			session_id: input.sessionId,
			user_id: input.userId,
			kind: input.kind,
			source: input.source,
			observation_type: input.observationType,
			payload: input.payload,
			idempotency_key: input.idempotencyKey,
		},
		{
			session_id: input.sessionId,
			idempotency_key: input.idempotencyKey,
		},
		"id, seq",
	);
	return { ...result.data, created: result.created };
}

export async function insertUsageRecord(
	supabase: SupabaseClient,
	input: {
		sessionId: string;
		userId: string;
		operationId: string;
		agentRole: "trainer" | "review";
		usage: {
			cachedIncludedInInput: boolean | null;
			cachedTokens: number | null;
			coverage: string;
			inputTokens: number | null;
			native: unknown;
			outputTokens: number | null;
		};
	},
) {
	return insertOnce(
		supabase,
		"usage_records",
		{
			session_id: input.sessionId,
			user_id: input.userId,
			operation_id: input.operationId,
			agent_role: input.agentRole,
			input_tokens: input.usage.inputTokens,
			output_tokens: input.usage.outputTokens,
			cached_tokens: input.usage.cachedTokens,
			cached_included_in_input: input.usage.cachedIncludedInInput,
			coverage: input.usage.coverage,
			native: input.usage.native,
		},
		{
			session_id: input.sessionId,
			operation_id: input.operationId,
		},
		"id, operation_id",
	);
}

export async function createSession(
	supabase: SupabaseClient,
	userId: string,
	exerciseId: string,
) {
	const challenge = getChallenge(exerciseId);
	if (!challenge) {
		throw new Error("Unknown exercise.");
	}
	const { data: session, error } = await supabase
		.from("sessions")
		.insert({
			user_id: userId,
			exercise_id: exerciseId,
			status: "pending_consent",
			files: challenge.starter,
			timezone: PROGRESS_TIMEZONE,
		})
		.select("*")
		.single();
	if (error || !session) {
		throw new PersistenceError("Could not create session.");
	}
	return session;
}

export async function startSession(
	supabase: SupabaseClient,
	userId: string,
	sessionId: string,
) {
	const { data: session, error } = await supabase
		.from("sessions")
		.select("*")
		.eq("id", sessionId)
		.eq("user_id", userId)
		.maybeSingle();
	if (error || !session) {
		throw new Error("Session not found.");
	}
	if (session.status !== "pending_consent" && session.status !== "running") {
		return session;
	}
	const challenge = getChallenge(session.exercise_id);
	if (!challenge) {
		throw new Error("Unknown exercise.");
	}
	const snapshot = buildExerciseSnapshot(challenge);
	await insertOnce(
		supabase,
		"exercise_snapshots",
		{
			session_id: sessionId,
			user_id: userId,
			exercise_id: snapshot.exerciseId,
			content_hash: snapshot.contentHash,
			spec_markdown: snapshot.specMarkdown,
			tests_source: snapshot.testsSource,
			starter: snapshot.starter,
			meta: snapshot.meta,
		},
		{ session_id: sessionId },
		"id",
	);
	await insertEvidence(supabase, {
		sessionId,
		userId,
		kind: "consent",
		source: "learner",
		observationType: "explicit_start",
		payload: {
			disclosed: [
				"prompts and assistant replies",
				"selected exercise snapshot",
				"browser test summaries",
				"provider usage when returned",
			],
		},
		idempotencyKey: operationId(["consent", sessionId]),
	});
	const { data: started, error: startError } = await supabase
		.from("sessions")
		.update({
			status: "running",
			consent_at: session.consent_at ?? new Date().toISOString(),
			started_at: session.started_at ?? new Date().toISOString(),
			updated_at: new Date().toISOString(),
		})
		.eq("id", sessionId)
		.eq("user_id", userId)
		.select("*")
		.single();
	if (startError || !started) {
		throw new PersistenceError("Could not start session.");
	}
	return started;
}

export async function saveFiles(
	supabase: SupabaseClient,
	userId: string,
	sessionId: string,
	files: Record<string, string>,
	expectedUpdatedAt?: string,
) {
	let query = supabase
		.from("sessions")
		.update({
			files,
			updated_at: new Date().toISOString(),
			save_error: null,
		})
		.eq("id", sessionId)
		.eq("user_id", userId)
		.eq("status", "running");
	if (expectedUpdatedAt) {
		query = query.eq("updated_at", expectedUpdatedAt);
	}
	const { data, error } = await query.select("id, updated_at").maybeSingle();
	if (error) {
		throw new PersistenceError("Save failed.");
	}
	if (!data) {
		if (expectedUpdatedAt) {
			const { data: current } = await supabase
				.from("sessions")
				.select("id, status, updated_at")
				.eq("id", sessionId)
				.eq("user_id", userId)
				.maybeSingle();
			if (current && current.status === "running") {
				throw new RevisionConflictError();
			}
		}
		throw new Error("Session is not running or not yours.");
	}
	return data;
}

export async function recordTestRun(
	supabase: SupabaseClient,
	input: {
		userId: string;
		sessionId: string;
		results: TestResult[];
		fatal?: string;
		files: Record<string, string>;
		expectedUpdatedAt?: string;
	},
) {
	const saved = await saveFiles(
		supabase,
		input.userId,
		input.sessionId,
		input.files,
		input.expectedUpdatedAt,
	);
	const { data: snapshot } = await supabase
		.from("exercise_snapshots")
		.select("id")
		.eq("session_id", input.sessionId)
		.eq("user_id", input.userId)
		.maybeSingle();
	if (!snapshot) {
		throw new Error("Snapshot missing.");
	}
	const evidence = await insertEvidence(supabase, {
		sessionId: input.sessionId,
		userId: input.userId,
		kind: "test_run",
		source: "browser",
		observationType: "browser_harness",
		payload: {
			results: input.results,
			fatal: input.fatal ?? null,
			provenance: "browser_harness",
		},
		idempotencyKey: newIdempotencyKey("test"),
	});
	const { data, error } = await supabase
		.from("test_runs")
		.insert({
			session_id: input.sessionId,
			user_id: input.userId,
			snapshot_id: snapshot.id,
			evidence_id: evidence.id,
			code_revision_hash: hashFiles(input.files),
			results: input.results,
			fatal: input.fatal ?? null,
			provenance: "browser_harness",
		})
		.select("*")
		.single();
	if (error || !data) {
		throw new PersistenceError("Could not store test run.");
	}
	return { ...data, savedAt: saved.updated_at };
}

export function dayBucket(iso: string, timeZone: string): string {
	const date = new Date(iso);
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);
	const year = parts.find((part) => part.type === "year")?.value;
	const month = parts.find((part) => part.type === "month")?.value;
	const day = parts.find((part) => part.type === "day")?.value;
	return `${year}-${month}-${day}`;
}
