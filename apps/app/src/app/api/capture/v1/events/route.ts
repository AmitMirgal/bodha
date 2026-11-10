import { NextResponse } from "next/server";
import { withRequestDevice } from "../../../../../lib/capture/auth";
import { generateCaptureTaskReport } from "../../../../../lib/capture/generate-report";
import {
	CaptureLimitError,
	ingestBatch,
} from "../../../../../lib/capture/ingest";
import { logCaptureRouteError } from "../../../../../lib/capture/log-route-error";
import { takeDeviceSlot } from "../../../../../lib/capture/rate-limit";
import { ingestBatchSchema } from "../../../../../lib/capture/schema";
import {
	runtimeRunWithDb,
	withDeviceDb,
	withUserDb,
} from "../../../../../lib/db/client";
import {
	LlmConfigError,
	resolveLlmForUser,
} from "../../../../../lib/llm/resolve-config";
import { runCaptureReview } from "../../../../../mastra/run";

const MAX_BODY = 256 * 1024;

function batchClosesTask(events: Array<{ kind?: string }>): boolean {
	return events.some((event) => event.kind === "session_end");
}

async function generateIfClaimed(deviceId: string, taskId: string) {
	const claimedUserId = await withDeviceDb(deviceId, async (db) => {
		const device = await db.device.findFirst({
			select: { claimedUserId: true },
			where: { id: deviceId },
		});
		return device?.claimedUserId ?? null;
	});
	if (!claimedUserId) {
		return;
	}
	await withUserDb(claimedUserId, (db) =>
		generateCaptureTaskReport(db, claimedUserId, taskId, {
			deps: {
				resolveLlm: async (inner, uid) => resolveLlmForUser(inner, uid),
				review: async ({ taskId: id }) => {
					const { apiKey, config } = await withUserDb(claimedUserId, (inner) =>
						resolveLlmForUser(inner, claimedUserId)
					);
					const result = await runCaptureReview({
						apiKey,
						config,
						messages: [
							{
								content:
									"Retrieve this editor task's captured evidence and return the JSON learning report fields summary, suggestions, and insufficientEvidence.",
								role: "user",
							},
						],
						role: "review",
						runWithDb: runtimeRunWithDb(),
						sessionId: id,
						userId: claimedUserId,
					});
					return result.model;
				},
			},
		})
	);
}

export async function POST(request: Request) {
	const raw = await request.text();
	if (raw.length > MAX_BODY) {
		return NextResponse.json(
			{ error: "Body too large.", code: "body_size" },
			{ status: 413 }
		);
	}
	let json: unknown;
	try {
		json = JSON.parse(raw);
	} catch {
		return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
	}
	const parsed = ingestBatchSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid event batch." },
			{ status: 400 }
		);
	}
	try {
		const result = await withRequestDevice(request, async (db, deviceId) => {
			if (!takeDeviceSlot(deviceId)) {
				throw new CaptureLimitError("Rate limit exceeded.", 429, "rate_limit");
			}
			const ingested = await ingestBatch(db, deviceId, parsed.data);
			return { deviceId, ingested };
		});
		if (!result) {
			return NextResponse.json({ error: "Unknown device." }, { status: 401 });
		}
		if (batchClosesTask(parsed.data.events) && result.ingested.taskId) {
			try {
				await generateIfClaimed(result.deviceId, result.ingested.taskId);
			} catch (error) {
				if (!(error instanceof LlmConfigError)) {
					logCaptureRouteError("POST /api/capture/v1/events generate", error);
				}
			}
		}
		return NextResponse.json(result.ingested);
	} catch (error) {
		if (error instanceof CaptureLimitError) {
			return NextResponse.json(
				{ error: error.message, code: error.code },
				{ status: error.status }
			);
		}
		logCaptureRouteError("POST /api/capture/v1/events", error);
		return NextResponse.json(
			{ error: "Could not ingest events." },
			{ status: 500 }
		);
	}
}
