import { toInputJson } from "../db/queries";
import type { MatiDb } from "../db/rls";
import { asInt, isoRequired } from "../db/rows";
import { redactProviderError } from "../errors";
import { reportClaimDecision } from "../sessions/report-claim";
import {
	assembleEditorLearningReport,
	type CaptureEventInput,
	type CaptureUsageInput,
} from "./report";

export interface CaptureReportRow {
	body: unknown;
	error: string | null;
	id: string;
	kind: "coached" | "facts_only";
	status: string;
	version: number;
}

export interface GenerateCaptureReportDeps {
	resolveLlm?: (db: MatiDb, userId: string) => Promise<unknown>;
	review?: (input: {
		events: CaptureEventInput[];
		taskId: string;
		usage: CaptureUsageInput[];
		userId: string;
	}) => Promise<unknown>;
}

function eventsFromTask(
	events: Array<{
		id: string;
		kind: string;
		occurredAt: Date;
		payload: unknown;
	}>
): CaptureEventInput[] {
	return events.map((event) => ({
		id: event.id,
		kind: event.kind,
		occurredAt: isoRequired(event.occurredAt),
		payload: event.payload,
	}));
}

function usageFromTask(
	usage: Array<{
		cachedTokens: bigint | number | null;
		inputTokens: bigint | number | null;
		outputTokens: bigint | number | null;
		provenance: string;
		reasoningTokens: bigint | number | null;
		source: string;
	}>
): CaptureUsageInput[] {
	return usage.map((row) => ({
		cachedTokens: asInt(row.cachedTokens),
		inputTokens: asInt(row.inputTokens),
		outputTokens: asInt(row.outputTokens),
		provenance: row.provenance,
		reasoningTokens: asInt(row.reasoningTokens),
		source: row.source,
	}));
}

function asRow(row: {
	body: unknown;
	error: string | null;
	id: string;
	status: string;
	version: number;
}): CaptureReportRow {
	const body =
		row.body && typeof row.body === "object"
			? (row.body as { kind?: unknown })
			: null;
	return {
		body: row.body,
		error: row.error,
		id: row.id,
		kind: body?.kind === "coached" ? "coached" : "facts_only",
		status: row.status,
		version: row.version,
	};
}

function claimInput(existing: { createdAt: Date; status: string } | null) {
	return existing
		? {
				created_at: existing.createdAt.toISOString(),
				status: existing.status,
			}
		: null;
}

function captureReportClaim(
	existing: { createdAt: Date; status: string } | null,
	force: boolean
) {
	if (force && existing?.status !== "running") {
		return { action: "create" as const };
	}
	return reportClaimDecision(claimInput(existing));
}

async function failCaptureReport(
	db: MatiDb,
	id: string,
	error: string,
	version: number,
	kind: CaptureReportRow["kind"] = "facts_only"
): Promise<CaptureReportRow> {
	await db.captureReport.update({
		data: { error, status: "failed" },
		where: { id },
	});
	return { body: null, error, id, kind, status: "failed", version };
}

export async function generateCaptureTaskReport(
	db: MatiDb,
	userId: string,
	taskId: string,
	options: { deps?: GenerateCaptureReportDeps; force?: boolean } = {}
): Promise<CaptureReportRow> {
	const task = await db.captureTask.findFirst({
		include: {
			events: { orderBy: { occurredAt: "asc" } },
			reports: { orderBy: { version: "desc" }, take: 1 },
			usage: true,
		},
		where: { id: taskId, userId },
	});
	if (!task) {
		throw new Error("Unknown task.");
	}
	const existing = task.reports[0] ?? null;
	const decision = captureReportClaim(existing, options.force === true);
	switch (decision.action) {
		case "replay":
		case "in_flight":
			if (!existing) {
				throw new Error("Missing report row.");
			}
			return asRow(existing);
		case "expire_then_create":
			if (existing) {
				await db.captureReport.update({
					data: {
						error:
							"Previous report claim went stale before completion. Evidence was kept. Retry to start a new version.",
						status: "failed",
					},
					where: { id: existing.id },
				});
			}
			break;
		case "create":
			break;
		default: {
			const exhaustive: never = decision;
			throw new Error(`Unhandled report claim: ${JSON.stringify(exhaustive)}`);
		}
	}

	const events = eventsFromTask(task.events);
	const usage = usageFromTask(task.usage);
	const version = (existing?.version ?? 0) + 1;
	const created = await db.captureReport.create({
		data: {
			status: "running",
			taskId,
			userId,
			version,
		},
	});

	let model: unknown;
	let kind: CaptureReportRow["kind"] = "facts_only";
	try {
		if (options.deps?.resolveLlm) {
			await options.deps.resolveLlm(db, userId);
		}
		if (options.deps?.review) {
			model = await options.deps.review({
				events,
				taskId,
				usage,
				userId,
			});
			kind = "coached";
		}
	} catch (error) {
		const name =
			error && typeof error === "object" && "name" in error
				? String(error.name)
				: "";
		if (name !== "LlmConfigError") {
			return await failCaptureReport(
				db,
				created.id,
				redactProviderError(error),
				version
			);
		}
	}

	const assembled = assembleEditorLearningReport({
		events,
		model,
		taskId,
		usage,
	});
	if (!assembled.ok) {
		return await failCaptureReport(
			db,
			created.id,
			assembled.error,
			version,
			kind
		);
	}
	const body = { ...assembled.report, kind };
	const complete = await db.captureReport.update({
		data: {
			body: toInputJson(body),
			error: null,
			status: "complete",
		},
		where: { id: created.id },
	});
	return asRow(complete);
}
