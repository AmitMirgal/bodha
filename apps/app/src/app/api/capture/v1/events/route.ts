import { NextResponse } from "next/server";
import { withRequestDevice } from "../../../../../lib/capture/auth";
import {
	CaptureLimitError,
	ingestBatch,
} from "../../../../../lib/capture/ingest";
import { takeDeviceSlot } from "../../../../../lib/capture/rate-limit";
import { ingestBatchSchema } from "../../../../../lib/capture/schema";

const MAX_BODY = 256 * 1024;

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
			return await ingestBatch(db, deviceId, parsed.data);
		});
		if (!result) {
			return NextResponse.json({ error: "Unknown device." }, { status: 401 });
		}
		return NextResponse.json(result);
	} catch (error) {
		if (error instanceof CaptureLimitError) {
			return NextResponse.json(
				{ error: error.message, code: error.code },
				{ status: error.status }
			);
		}
		return NextResponse.json(
			{ error: "Could not ingest events." },
			{ status: 500 }
		);
	}
}
