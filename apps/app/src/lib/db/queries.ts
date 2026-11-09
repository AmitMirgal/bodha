import type { Prisma } from "../../generated/prisma/client";
import { PersistenceError, RevisionConflictError } from "../errors";
import { insertOnce } from "./insert-once";
import type { MatiDb } from "./rls";
import {
	isoRequired,
	messageRow,
	reportRow,
	sessionRow,
	snapshotRound,
	snapshotSummary,
} from "./rows";

export async function listSessions(db: MatiDb, userId: string) {
	const rows = await db.session.findMany({
		where: { userId },
		orderBy: { createdAt: "desc" },
	});
	return rows.map(sessionRow);
}

export async function getSession(db: MatiDb, sessionId: string) {
	const session = await db.session.findFirst({ where: { id: sessionId } });
	return session ? sessionRow(session) : null;
}

export async function createSessionRow(
	db: MatiDb,
	userId: string,
	exerciseId: string,
	files: Record<string, string>,
	timezone: string
) {
	const session = await db.session.create({
		data: {
			userId,
			exerciseId,
			status: "pending_consent",
			files,
			timezone,
		},
	});
	return sessionRow(session);
}

export async function insertSnapshotOnce(
	db: MatiDb,
	input: {
		sessionId: string;
		userId: string;
		exerciseId: string;
		contentHash: string;
		specMarkdown: string;
		testsSource: string;
		starter: Record<string, string>;
		meta: Prisma.InputJsonValue;
	}
) {
	return await insertOnce(
		db,
		() =>
			db.exerciseSnapshot.create({
				data: input,
				select: { id: true },
			}),
		() =>
			db.exerciseSnapshot.findFirst({
				where: { sessionId: input.sessionId },
				select: { id: true },
			})
	);
}

export async function getSnapshot(db: MatiDb, sessionId: string) {
	const snapshot = await db.exerciseSnapshot.findFirst({
		where: { sessionId },
	});
	return snapshot;
}

export async function getSnapshotSummary(db: MatiDb, sessionId: string) {
	const snapshot = await getSnapshot(db, sessionId);
	return snapshot ? snapshotSummary(snapshot) : null;
}

export async function getSnapshotRound(db: MatiDb, sessionId: string) {
	const snapshot = await getSnapshot(db, sessionId);
	return snapshot ? snapshotRound(snapshot) : null;
}

export async function insertEvidenceOnce(
	db: MatiDb,
	input: {
		sessionId: string;
		userId: string;
		kind: string;
		source: string;
		observationType: string;
		payload: Prisma.InputJsonValue;
		idempotencyKey: string;
	}
) {
	const result = await insertOnce(
		db,
		() =>
			db.evidenceEvent.create({
				data: input,
				select: { id: true, seq: true },
			}),
		() =>
			db.evidenceEvent.findFirst({
				where: {
					sessionId: input.sessionId,
					idempotencyKey: input.idempotencyKey,
				},
				select: { id: true, seq: true },
			})
	);
	return {
		created: result.created,
		id: result.data.id,
		seq: Number(result.data.seq),
	};
}

export async function findEvidencePayload(
	db: MatiDb,
	sessionId: string,
	idempotencyKey: string
) {
	const row = await db.evidenceEvent.findFirst({
		where: { sessionId, idempotencyKey },
		select: { payload: true },
	});
	return row?.payload ?? null;
}

export async function listEvidence(db: MatiDb, sessionId: string) {
	return await db.evidenceEvent.findMany({
		where: { sessionId },
		orderBy: { seq: "asc" },
	});
}

export async function insertMessage(
	db: MatiDb,
	input: {
		sessionId: string;
		userId: string;
		evidenceId?: string | null;
		role: string;
		content: string;
	}
) {
	await db.message.create({ data: input });
}

export async function listMessages(db: MatiDb, sessionId: string) {
	const rows = await db.message.findMany({
		where: { sessionId },
		orderBy: { createdAt: "asc" },
	});
	return rows.map(messageRow);
}

export async function listRecentChatTurns(db: MatiDb, sessionId: string) {
	return await db.message.findMany({
		where: {
			sessionId,
			role: { in: ["user", "assistant"] },
		},
		orderBy: { createdAt: "desc" },
		take: 20,
		select: { role: true, content: true },
	});
}

export async function updateRunningSession(
	db: MatiDb,
	sessionId: string,
	data: Prisma.SessionUpdateManyMutationInput,
	expectedUpdatedAt?: string
) {
	const result = await db.session.updateMany({
		where: {
			id: sessionId,
			status: "running",
			...(expectedUpdatedAt ? { updatedAt: new Date(expectedUpdatedAt) } : {}),
		},
		data,
	});
	if (result.count === 1) {
		const current = await db.session.findFirst({ where: { id: sessionId } });
		if (!current) {
			throw new PersistenceError("Save failed.");
		}
		return { id: current.id, updated_at: isoRequired(current.updatedAt) };
	}
	if (expectedUpdatedAt) {
		const current = await db.session.findFirst({
			where: { id: sessionId },
			select: { id: true, status: true, updatedAt: true },
		});
		if (current && current.status === "running") {
			throw new RevisionConflictError();
		}
	}
	throw new Error("Session is not running or not yours.");
}

export async function saveSessionFiles(
	db: MatiDb,
	sessionId: string,
	files: Record<string, string>,
	expectedUpdatedAt?: string
) {
	return await updateRunningSession(
		db,
		sessionId,
		{
			files,
			updatedAt: new Date(),
			saveError: null,
		},
		expectedUpdatedAt
	);
}

export async function startRunningSession(
	db: MatiDb,
	sessionId: string,
	consentAt: Date,
	startedAt: Date
) {
	const started = await db.session.update({
		where: { id: sessionId },
		data: {
			status: "running",
			consentAt,
			startedAt,
			updatedAt: new Date(),
		},
	});
	return sessionRow(started);
}

export async function insertTestRun(
	db: MatiDb,
	input: {
		sessionId: string;
		userId: string;
		snapshotId: string;
		evidenceId: string;
		codeRevisionHash: string;
		results: Prisma.InputJsonValue;
		fatal: string | null;
	}
) {
	const run = await db.testRun.create({
		data: {
			...input,
			provenance: "browser_harness",
		},
	});
	return run;
}

export async function latestTestRun(db: MatiDb, sessionId: string) {
	return await db.testRun.findFirst({
		where: { sessionId },
		orderBy: { createdAt: "desc" },
	});
}

export async function latestReport(db: MatiDb, sessionId: string) {
	const report = await db.report.findFirst({
		where: { sessionId },
		orderBy: { version: "desc" },
	});
	return report ? reportRow(report) : null;
}

export async function listReports(db: MatiDb, sessionId: string) {
	const rows = await db.report.findMany({
		where: { sessionId },
		orderBy: { version: "desc" },
	});
	return rows.map(reportRow);
}

export async function insertReportOnce(
	db: MatiDb,
	input: {
		sessionId: string;
		userId: string;
		snapshotId: string;
		version: number;
		status: string;
	}
) {
	return await insertOnce(
		db,
		() =>
			db.report.create({
				data: input,
				select: { id: true, status: true },
			}),
		() =>
			db.report.findFirst({
				where: { sessionId: input.sessionId, version: input.version },
				select: { id: true, status: true },
			})
	);
}

export async function getReport(db: MatiDb, id: string) {
	const report = await db.report.findFirst({ where: { id } });
	return report ? reportRow(report) : null;
}

export async function updateReport(
	db: MatiDb,
	id: string,
	data: Prisma.ReportUpdateManyMutationInput
) {
	await db.report.updateMany({ where: { id }, data });
}

export async function completeReport(
	db: MatiDb,
	id: string,
	body: Prisma.InputJsonValue
) {
	const updated = await db.report.update({
		where: { id },
		data: { status: "complete", body, error: null },
	});
	return reportRow(updated);
}

export async function updateSessionStatus(
	db: MatiDb,
	sessionId: string,
	data: Prisma.SessionUpdateManyMutationInput
) {
	await db.session.updateMany({ where: { id: sessionId }, data });
}

export async function insertUsageOnce(
	db: MatiDb,
	input: {
		sessionId: string;
		userId: string;
		operationId: string;
		agentRole: "trainer" | "review";
		inputTokens: bigint | null;
		outputTokens: bigint | null;
		cachedTokens: bigint | null;
		cachedIncludedInInput: boolean | null;
		coverage: string;
		native: Prisma.InputJsonValue;
	}
) {
	return await insertOnce(
		db,
		() =>
			db.usageRecord.create({
				data: input,
				select: { id: true, operationId: true },
			}),
		() =>
			db.usageRecord.findFirst({
				where: {
					sessionId: input.sessionId,
					operationId: input.operationId,
				},
				select: { id: true, operationId: true },
			})
	);
}

export async function listUsage(db: MatiDb, sessionId: string) {
	return await db.usageRecord.findMany({ where: { sessionId } });
}

export async function getMaskedLlmRow(db: MatiDb, userId: string) {
	return await db.llmSettings.findUnique({
		where: { userId },
		select: {
			provider: true,
			model: true,
			baseUrl: true,
			keyFingerprint: true,
			capabilities: true,
		},
	});
}

export async function getLlmSecrets(db: MatiDb, userId: string) {
	return await db.llmSettings.findUnique({
		where: { userId },
		select: {
			provider: true,
			model: true,
			baseUrl: true,
			encryptedApiKey: true,
			encryptionIv: true,
			encryptionTag: true,
			keyFingerprint: true,
			capabilities: true,
		},
	});
}

export function toInputJson(value: unknown): Prisma.InputJsonValue {
	return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function upsertLlmSettings(
	db: MatiDb,
	input: {
		userId: string;
		provider: string;
		model: string;
		baseUrl: string;
		encryptedApiKey: string;
		encryptionIv: string;
		encryptionTag: string;
		keyFingerprint: string;
		capabilities: unknown;
	}
) {
	const capabilities = toInputJson(input.capabilities);
	await db.llmSettings.upsert({
		where: { userId: input.userId },
		create: { ...input, capabilities },
		update: {
			provider: input.provider,
			model: input.model,
			baseUrl: input.baseUrl,
			encryptedApiKey: input.encryptedApiKey,
			encryptionIv: input.encryptionIv,
			encryptionTag: input.encryptionTag,
			keyFingerprint: input.keyFingerprint,
			capabilities,
			updatedAt: new Date(),
		},
	});
}

export async function deleteLlmSettings(db: MatiDb, userId: string) {
	await db.llmSettings.deleteMany({ where: { userId } });
}

export async function hasLlmSettings(db: MatiDb, userId: string) {
	const row = await db.llmSettings.findUnique({
		where: { userId },
		select: { userId: true },
	});
	return Boolean(row);
}

export { asFiles } from "./rows";
