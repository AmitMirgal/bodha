import type {
	EvidenceEvent,
	ExerciseSnapshot,
	Message,
	Report,
	Session,
	TestRun,
	UsageRecord,
} from "../../generated/prisma/client";

export function iso(value: Date | null | undefined): string | null {
	return value ? value.toISOString() : null;
}

export function isoRequired(value: Date): string {
	return value.toISOString();
}

export function asInt(
	value: bigint | number | null | undefined
): number | null {
	if (value == null) {
		return null;
	}
	return Number(value);
}

export function asFiles(value: unknown): Record<string, string> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}
	const files: Record<string, string> = {};
	for (const [key, entry] of Object.entries(value)) {
		if (typeof entry === "string") {
			files[key] = entry;
		}
	}
	return files;
}

export function sessionRow(session: Session) {
	return {
		id: session.id,
		user_id: session.userId,
		exercise_id: session.exerciseId,
		status: session.status,
		files: asFiles(session.files),
		timezone: session.timezone,
		consent_at: iso(session.consentAt),
		started_at: iso(session.startedAt),
		finished_at: iso(session.finishedAt),
		save_error: session.saveError,
		created_at: isoRequired(session.createdAt),
		updated_at: isoRequired(session.updatedAt),
	};
}

export function snapshotSummary(snapshot: ExerciseSnapshot) {
	return {
		id: snapshot.id,
		content_hash: snapshot.contentHash,
		exercise_id: snapshot.exerciseId,
		meta: snapshot.meta,
		created_at: isoRequired(snapshot.createdAt),
	};
}

export function snapshotRound(snapshot: ExerciseSnapshot) {
	return {
		exercise_id: snapshot.exerciseId,
		spec_markdown: snapshot.specMarkdown,
		tests_source: snapshot.testsSource,
		starter: asFiles(snapshot.starter),
		meta: snapshot.meta,
	};
}

export function messageRow(message: Message) {
	return {
		id: message.id,
		role: message.role,
		content: message.content,
		created_at: isoRequired(message.createdAt),
	};
}

export function reportRow(report: Report) {
	return {
		id: report.id,
		session_id: report.sessionId,
		user_id: report.userId,
		snapshot_id: report.snapshotId,
		version: report.version,
		status: report.status,
		body: report.body,
		error: report.error,
		created_at: isoRequired(report.createdAt),
	};
}

export function evidenceRow(event: EvidenceEvent) {
	return {
		id: event.id,
		seq: Number(event.seq),
		kind: event.kind,
		source: event.source,
		observationType: event.observationType,
		payload: event.payload,
		createdAt: isoRequired(event.createdAt),
	};
}

export function testRunRow(run: TestRun) {
	return {
		id: run.id,
		results: run.results,
		fatal: run.fatal,
		provenance: run.provenance,
		codeRevisionHash: run.codeRevisionHash,
		createdAt: isoRequired(run.createdAt),
	};
}

export function usageRow(record: UsageRecord) {
	return {
		agent_role: record.agentRole,
		input_tokens: asInt(record.inputTokens),
		output_tokens: asInt(record.outputTokens),
		cached_tokens: asInt(record.cachedTokens),
		cached_included_in_input: record.cachedIncludedInInput,
		coverage: record.coverage,
		native: record.native,
	};
}
