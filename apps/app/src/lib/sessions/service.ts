import { getChallenge } from "../challenges";
import {
	createSessionRow,
	getSession,
	getSnapshot,
	insertEvidenceOnce,
	insertSnapshotOnce,
	insertTestRun,
	insertUsageOnce,
	saveSessionFiles,
	startRunningSession,
} from "../db/queries";
import type { BodhaDb } from "../db/rls";
import { PROGRESS_TIMEZONE } from "../env";
import { PersistenceError } from "../errors";
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
	db: BodhaDb,
	input: {
		sessionId: string;
		userId: string;
		kind: string;
		source: string;
		observationType: string;
		payload: unknown;
		idempotencyKey: string;
	}
) {
	return await insertEvidenceOnce(db, {
		sessionId: input.sessionId,
		userId: input.userId,
		kind: input.kind,
		source: input.source,
		observationType: input.observationType,
		payload: input.payload as never,
		idempotencyKey: input.idempotencyKey,
	});
}

export async function insertUsageRecord(
	db: BodhaDb,
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
	}
) {
	return await insertUsageOnce(db, {
		sessionId: input.sessionId,
		userId: input.userId,
		operationId: input.operationId,
		agentRole: input.agentRole,
		inputTokens:
			input.usage.inputTokens == null ? null : BigInt(input.usage.inputTokens),
		outputTokens:
			input.usage.outputTokens == null
				? null
				: BigInt(input.usage.outputTokens),
		cachedTokens:
			input.usage.cachedTokens == null
				? null
				: BigInt(input.usage.cachedTokens),
		cachedIncludedInInput: input.usage.cachedIncludedInInput,
		coverage: input.usage.coverage,
		native: (input.usage.native ?? null) as never,
	});
}

export async function createSession(
	db: BodhaDb,
	userId: string,
	exerciseId: string
) {
	const challenge = getChallenge(exerciseId);
	if (!challenge) {
		throw new Error("Unknown exercise.");
	}
	try {
		return await createSessionRow(
			db,
			userId,
			exerciseId,
			challenge.starter,
			PROGRESS_TIMEZONE
		);
	} catch {
		throw new PersistenceError("Could not create session.");
	}
}

export async function startSession(
	db: BodhaDb,
	userId: string,
	sessionId: string
) {
	const session = await getSession(db, sessionId);
	if (!session) {
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
	await insertSnapshotOnce(db, {
		sessionId,
		userId,
		exerciseId: snapshot.exerciseId,
		contentHash: snapshot.contentHash,
		specMarkdown: snapshot.specMarkdown,
		testsSource: snapshot.testsSource,
		starter: snapshot.starter,
		meta: snapshot.meta as never,
	});
	await insertEvidence(db, {
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
	try {
		return await startRunningSession(
			db,
			sessionId,
			session.consent_at ? new Date(session.consent_at) : new Date(),
			session.started_at ? new Date(session.started_at) : new Date()
		);
	} catch {
		throw new PersistenceError("Could not start session.");
	}
}

export async function saveFiles(
	db: BodhaDb,
	_userId: string,
	sessionId: string,
	files: Record<string, string>,
	expectedUpdatedAt?: string
) {
	return await saveSessionFiles(db, sessionId, files, expectedUpdatedAt);
}

export async function recordTestRun(
	db: BodhaDb,
	input: {
		userId: string;
		sessionId: string;
		results: TestResult[];
		fatal?: string;
		files: Record<string, string>;
		expectedUpdatedAt?: string;
	}
) {
	const saved = await saveFiles(
		db,
		input.userId,
		input.sessionId,
		input.files,
		input.expectedUpdatedAt
	);
	const snapshot = await getSnapshot(db, input.sessionId);
	if (!snapshot) {
		throw new Error("Snapshot missing.");
	}
	const evidence = await insertEvidence(db, {
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
	try {
		const data = await insertTestRun(db, {
			sessionId: input.sessionId,
			userId: input.userId,
			snapshotId: snapshot.id,
			evidenceId: evidence.id,
			codeRevisionHash: hashFiles(input.files),
			results: input.results as never,
			fatal: input.fatal ?? null,
		});
		return { ...data, savedAt: saved.updated_at };
	} catch {
		throw new PersistenceError("Could not store test run.");
	}
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
