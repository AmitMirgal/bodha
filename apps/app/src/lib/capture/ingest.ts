import { toInputJson } from "../db/queries";
import type { MatiDb } from "../db/rls";
import type { IngestBatch } from "./schema";

const MAX_EVENTS_PER_DEVICE = 10_000;

export class CaptureLimitError extends Error {
	status: number;
	code: string;
	constructor(message: string, status: number, code: string) {
		super(message);
		this.name = "CaptureLimitError";
		this.status = status;
		this.code = code;
	}
}

function payloadFor(event: IngestBatch["events"][number]): {
	kind: "prompt" | "response" | "session_end";
	payload: Record<string, unknown>;
} {
	switch (event.kind) {
		case "prompt":
			return {
				kind: "prompt",
				payload: {
					text: event.text ?? "",
					attachmentNames: event.attachmentNames ?? [],
					generationId: event.generationId ?? null,
				},
			};
		case "response":
			return {
				kind: "response",
				payload: {
					text: event.text ?? "",
					generationId: event.generationId ?? null,
				},
			};
		case "session_end":
			return {
				kind: "session_end",
				payload: { reason: event.reason ?? "unknown" },
			};
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
					taskId: task.id,
					deviceId,
					kind: packed.kind,
					payload: toInputJson(packed.payload),
					idempotencyKey: event.idempotencyKey,
					occurredAt: new Date(event.occurredAt),
				},
			});
			accepted += 1;
		}
		if (packed.kind === "session_end" && task.status !== "closed") {
			await db.captureTask.update({
				where: { id: task.id },
				data: {
					status: "closed",
					finishedAt: new Date(event.occurredAt),
				},
			});
			task.status = "closed";
		}
	}
	if (task.status === "open") {
		const missing = await db.captureUsage.findFirst({
			where: { taskId: task.id, operationId: "task-missing" },
		});
		if (!missing) {
			await db.captureUsage.create({
				data: {
					taskId: task.id,
					deviceId,
					operationId: "task-missing",
					provenance: "missing",
					source: "none",
				},
			});
		}
	}
	return { accepted, taskId: task.id };
}

export async function listDeviceTasks(db: MatiDb, deviceId: string) {
	const tasks = await db.captureTask.findMany({
		where: { deviceId },
		orderBy: { startedAt: "desc" },
		include: {
			events: { orderBy: { occurredAt: "asc" } },
			usage: true,
		},
	});
	return tasks.map((task) => ({
		id: task.id,
		editor: task.editor,
		editorTaskId: task.editorTaskId,
		status: task.status,
		startedAt: task.startedAt.toISOString(),
		finishedAt: task.finishedAt?.toISOString() ?? null,
		prompts: task.events
			.filter((event) => event.kind === "prompt")
			.map((event) => {
				const payload = event.payload as { text?: unknown };
				return typeof payload.text === "string" ? payload.text : "";
			})
			.filter((text) => text.length > 0),
		usage: task.usage.map((row) => ({
			provenance: row.provenance,
			source: row.source,
			inputTokens: row.inputTokens === null ? null : Number(row.inputTokens),
			outputTokens: row.outputTokens === null ? null : Number(row.outputTokens),
			cachedTokens: row.cachedTokens === null ? null : Number(row.cachedTokens),
		})),
	}));
}
