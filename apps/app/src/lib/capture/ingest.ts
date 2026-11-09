import { toInputJson } from "../db/queries";
import type { MatiDb } from "../db/rls";
import { redactSecrets } from "./redact";
import type { IngestBatch } from "./schema";

const MAX_EVENTS_PER_DEVICE = 10_000;

export class CaptureLimitError extends Error {
	code: string;
	status: number;
	constructor(message: string, status: number, code: string) {
		super(message);
		this.name = "CaptureLimitError";
		this.status = status;
		this.code = code;
	}
}

interface Packed {
	kind: IngestBatch["events"][number]["kind"];
	payload: Record<string, unknown>;
}

function usagePayload(event: IngestBatch["events"][number]): Packed {
	if (event.provenance === "measured" && event.source === "text_estimate") {
		throw new CaptureLimitError(
			"text_estimate cannot be stored as measured.",
			400,
			"invalid_usage"
		);
	}
	if (event.provenance === "estimated" && event.source !== "text_estimate") {
		throw new CaptureLimitError(
			"estimated usage must use source text_estimate.",
			400,
			"invalid_usage"
		);
	}
	if (
		event.provenance === "measured" &&
		event.source !== "copilot_otel_chat_span" &&
		event.source !== "cursor_admin_api"
	) {
		throw new CaptureLimitError(
			"measured usage must come from copilot_otel_chat_span or cursor_admin_api.",
			400,
			"invalid_usage"
		);
	}
	return {
		kind: "usage",
		payload: {
			cachedTokens: event.cachedTokens ?? null,
			inputTokens: event.inputTokens ?? null,
			model: event.model ?? null,
			operationId: event.operationId ?? "unknown",
			outputTokens: event.outputTokens ?? null,
			provenance: event.provenance ?? "missing",
			reasoningTokens: event.reasoningTokens ?? null,
			source: event.source ?? "none",
		},
	};
}

function payloadFor(event: IngestBatch["events"][number]): Packed {
	switch (event.kind) {
		case "prompt":
			return {
				kind: "prompt",
				payload: {
					attachmentNames: event.attachmentNames ?? [],
					generationId: event.generationId ?? null,
					text: redactSecrets(event.text ?? ""),
				},
			};
		case "response":
			return {
				kind: "response",
				payload: {
					generationId: event.generationId ?? null,
					text: redactSecrets(event.text ?? ""),
				},
			};
		case "session_end":
			return {
				kind: "session_end",
				payload: { reason: event.reason ?? "unknown" },
			};
		case "file_edit":
			return {
				kind: "file_edit",
				payload: {
					editCount: event.editCount ?? 0,
					path: event.path ?? "",
					snippets: null,
				},
			};
		case "context_compact":
			return {
				kind: "context_compact",
				payload: {
					contextTokens: event.contextTokens ?? null,
					contextUsagePercent: event.contextUsagePercent ?? null,
					contextWindowSize: event.contextWindowSize ?? null,
					trigger: event.trigger ?? "unknown",
				},
			};
		case "usage":
			return usagePayload(event);
		default: {
			const exhaustive: never = event.kind;
			throw new CaptureLimitError(
				`Unhandled event kind: ${String(exhaustive)}`,
				400,
				"invalid_kind"
			);
		}
	}
}

function asBigInt(value: unknown): bigint | null {
	return typeof value === "number" ? BigInt(value) : null;
}

async function writeUsageRow(
	db: MatiDb,
	deviceId: string,
	taskId: string,
	payload: Record<string, unknown>
): Promise<void> {
	const operationId =
		typeof payload.operationId === "string" ? payload.operationId : "unknown";
	const existing = await db.captureUsage.findFirst({
		where: { operationId, taskId },
	});
	if (existing) {
		return;
	}
	await db.captureUsage.create({
		data: {
			cachedTokens: asBigInt(payload.cachedTokens),
			deviceId,
			inputTokens: asBigInt(payload.inputTokens),
			model: typeof payload.model === "string" ? payload.model : null,
			operationId,
			outputTokens: asBigInt(payload.outputTokens),
			provenance:
				typeof payload.provenance === "string" ? payload.provenance : "missing",
			reasoningTokens: asBigInt(payload.reasoningTokens),
			source: typeof payload.source === "string" ? payload.source : "none",
			taskId,
		},
	});
}

export async function ingestBatch(
	db: MatiDb,
	deviceId: string,
	batch: IngestBatch
): Promise<{ accepted: number; taskId: string }> {
	const existingCount = await db.captureEvent.count({ where: { deviceId } });
	if (existingCount + batch.events.length > MAX_EVENTS_PER_DEVICE) {
		throw new CaptureLimitError(
			"Unclaimed device event cap reached.",
			429,
			"event_cap"
		);
	}
	let task = await db.captureTask.findFirst({
		where: {
			deviceId,
			editor: batch.editor,
			editorTaskId: batch.editorTaskId,
		},
	});
	if (!task) {
		task = await db.captureTask.create({
			data: {
				deviceId,
				editor: batch.editor,
				editorTaskId: batch.editorTaskId,
				status: "open",
				workspaceHash: batch.workspaceHash,
			},
		});
	}
	let accepted = 0;
	for (const event of batch.events) {
		const packed = payloadFor(event);
		const prior = await db.captureEvent.findFirst({
			where: { deviceId, idempotencyKey: event.idempotencyKey },
			select: { id: true },
		});
		if (!prior) {
			await db.captureEvent.create({
				data: {
					deviceId,
					idempotencyKey: event.idempotencyKey,
					kind: packed.kind,
					occurredAt: new Date(event.occurredAt),
					payload: toInputJson(packed.payload),
					taskId: task.id,
				},
			});
			accepted += 1;
		}
		if (packed.kind === "session_end" && task.status !== "closed") {
			await db.captureTask.update({
				where: { id: task.id },
				data: {
					finishedAt: new Date(event.occurredAt),
					status: "closed",
				},
			});
			task.status = "closed";
		}
		if (packed.kind === "usage") {
			await writeUsageRow(db, deviceId, task.id, packed.payload);
		}
	}
	const hasUsage = await db.captureUsage.findFirst({
		where: { taskId: task.id },
	});
	if (!hasUsage) {
		await db.captureUsage.create({
			data: {
				deviceId,
				operationId: "task-missing",
				provenance: "missing",
				source: "none",
				taskId: task.id,
			},
		});
	}
	return { accepted, taskId: task.id };
}

export async function listDeviceTasks(db: MatiDb, deviceId: string) {
	const tasks = await db.captureTask.findMany({
		include: {
			events: { orderBy: { occurredAt: "asc" } },
			usage: true,
		},
		orderBy: { startedAt: "desc" },
		where: { deviceId },
	});
	return tasks.map((task) => ({
		editor: task.editor,
		editorTaskId: task.editorTaskId,
		filePaths: task.events
			.filter((event) => event.kind === "file_edit")
			.map((event) => {
				const payload = event.payload as { path?: unknown };
				return typeof payload.path === "string" ? payload.path : "";
			})
			.filter((path) => path.length > 0),
		finishedAt: task.finishedAt?.toISOString() ?? null,
		id: task.id,
		prompts: task.events
			.filter((event) => event.kind === "prompt")
			.map((event) => {
				const payload = event.payload as { text?: unknown };
				return typeof payload.text === "string" ? payload.text : "";
			})
			.filter((text) => text.length > 0),
		startedAt: task.startedAt.toISOString(),
		status: task.status,
		usage: task.usage.map((row) => ({
			cachedTokens: row.cachedTokens === null ? null : Number(row.cachedTokens),
			inputTokens: row.inputTokens === null ? null : Number(row.inputTokens),
			outputTokens: row.outputTokens === null ? null : Number(row.outputTokens),
			provenance: row.provenance,
			reasoningTokens:
				row.reasoningTokens === null ? null : Number(row.reasoningTokens),
			source: row.source,
		})),
	}));
}
