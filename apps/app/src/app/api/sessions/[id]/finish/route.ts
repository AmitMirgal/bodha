import { NextResponse } from "next/server";
import { z } from "zod";
import { runtimeRunWithDb, withUserDb } from "../../../../../lib/db/client";
import {
	completeReport,
	getReport,
	getSnapshot,
	insertReportOnce,
	latestReport,
	listEvidence,
	listUsage,
	updateReport,
	updateSessionStatus,
} from "../../../../../lib/db/queries";
import { usageRow } from "../../../../../lib/db/rows";
import { redactProviderError } from "../../../../../lib/errors";
import { operationId } from "../../../../../lib/idempotency";
import {
	LlmConfigError,
	resolveLlmForUser,
} from "../../../../../lib/llm/resolve-config";
import { assembleLearningReport } from "../../../../../lib/reports/assemble";
import { reportClaimDecision } from "../../../../../lib/sessions/report-claim";
import { insertUsageRecord } from "../../../../../lib/sessions/service";
import { requireUser } from "../../../../../lib/supabase/server";
import {
	AgentBudgetError,
	MissingToolUseError,
	runReview,
} from "../../../../../mastra/run";

const schema = z.object({
	clientRequestId: z.string().uuid(),
});

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	const parsed = schema.safeParse(await request.json().catch(() => ({})));
	const clientRequestId = parsed.success
		? parsed.data.clientRequestId
		: crypto.randomUUID();

	const session = await withUserDb(userId, (db) =>
		db.session.findFirst({ where: { id } })
	);
	if (!session) {
		return NextResponse.json({ error: "Not found." }, { status: 404 });
	}

	const existing = await withUserDb(userId, (db) => latestReport(db, id));
	const decision = reportClaimDecision(
		existing
			? {
					status: String(existing.status),
					created_at: String(existing.created_at),
				}
			: null
	);
	switch (decision.action) {
		case "replay":
			return NextResponse.json({ report: existing, replayed: true });
		case "in_flight":
			return NextResponse.json(
				{ error: "A report is already running.", report: existing },
				{ status: 409 }
			);
		case "expire_then_create":
			if (existing) {
				await withUserDb(userId, (db) =>
					updateReport(db, existing.id, {
						status: "failed",
						error:
							"Previous report claim went stale before completion. Evidence was kept. Retry to start a new version.",
					})
				);
			}
			break;
		case "create":
			break;
		default: {
			const exhaustive: never = decision;
			throw new Error(`Unhandled report claim: ${JSON.stringify(exhaustive)}`);
		}
	}

	const snapshot = await withUserDb(userId, (db) => getSnapshot(db, id));
	if (!snapshot) {
		return NextResponse.json({ error: "Snapshot missing." }, { status: 409 });
	}

	const version = (existing?.version ?? 0) + 1;
	let reportRow: { id: string };
	try {
		const inserted = await withUserDb(userId, (db) =>
			insertReportOnce(db, {
				sessionId: id,
				userId,
				snapshotId: snapshot.id,
				version,
				status: "running",
			})
		);
		if (!inserted.created) {
			if (inserted.data.status === "complete") {
				const complete = await withUserDb(userId, (db) =>
					getReport(db, inserted.data.id)
				);
				return NextResponse.json({ report: complete, replayed: true });
			}
			return NextResponse.json(
				{ error: "A report is already running." },
				{ status: 409 }
			);
		}
		reportRow = inserted.data;
	} catch {
		return NextResponse.json(
			{ error: "Could not start report." },
			{ status: 500 }
		);
	}

	try {
		await withUserDb(userId, (db) =>
			updateSessionStatus(db, id, {
				status: "finalizing",
				updatedAt: new Date(),
			})
		);
	} catch {
		await withUserDb(userId, (db) =>
			updateReport(db, reportRow.id, {
				status: "failed",
				error: "Could not finalize session after claiming the report run.",
			})
		);
		return NextResponse.json(
			{ error: "Could not finalize session.", evidencePreserved: true },
			{ status: 500 }
		);
	}

	try {
		const { config, apiKey } = await withUserDb(userId, (db) =>
			resolveLlmForUser(db, userId)
		);
		const result = await runReview({
			runWithDb: runtimeRunWithDb(),
			userId,
			sessionId: id,
			role: "review",
			config,
			apiKey,
			messages: [
				{
					role: "user",
					content:
						"Retrieve this session's snapshot, evidence, and latest test run, then return the JSON learning report fields summary, suggestions, and insufficientEvidence.",
				},
			],
		});

		await withUserDb(userId, (db) =>
			insertUsageRecord(db, {
				sessionId: id,
				userId,
				operationId: operationId(["review", id, clientRequestId]),
				agentRole: "review",
				usage: result.usage,
			})
		);

		const evidence = await withUserDb(userId, (db) => listEvidence(db, id));
		const usageRows = await withUserDb(userId, (db) => listUsage(db, id));

		const assembled = assembleLearningReport({
			model: result.model,
			evidence: evidence.map((row) => ({
				id: row.id,
				kind: row.kind,
				sessionId: row.sessionId,
				payload: row.payload,
			})),
			usageRows: usageRows.map(usageRow),
			sessionId: id,
		});
		if (!assembled.ok) {
			throw new Error(assembled.error);
		}

		const complete = await withUserDb(userId, (db) =>
			completeReport(db, reportRow.id, assembled.report as never)
		);

		await withUserDb(userId, (db) =>
			updateSessionStatus(db, id, {
				status: "complete",
				finishedAt: new Date(),
				updatedAt: new Date(),
			})
		);

		return NextResponse.json({
			report: complete,
			usage: assembled.report.usage,
			source: config.source,
		});
	} catch (error) {
		const message = redactProviderError(error);
		const incomplete =
			error instanceof MissingToolUseError || error instanceof AgentBudgetError;
		await withUserDb(userId, (db) =>
			updateReport(db, reportRow.id, {
				status: incomplete ? "incomplete" : "failed",
				error: message,
			})
		);
		await withUserDb(userId, (db) =>
			updateSessionStatus(db, id, {
				status: "failed",
				updatedAt: new Date(),
			})
		);
		const status = error instanceof LlmConfigError ? 400 : 500;
		return NextResponse.json(
			{ error: message, incomplete, evidencePreserved: true },
			{ status }
		);
	}
}
