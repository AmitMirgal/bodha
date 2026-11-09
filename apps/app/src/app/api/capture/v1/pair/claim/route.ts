import { NextResponse } from "next/server";
import { z } from "zod";
import { deviceIdFromRequest } from "../../../../../../lib/capture/auth";
import { claimDevice, PairingError } from "../../../../../../lib/capture/pair";
import { takeDeviceSlot } from "../../../../../../lib/capture/rate-limit";
import { withDeviceDb } from "../../../../../../lib/db/client";

const bodySchema = z.object({
	code: z.string().min(8).max(8),
});

export async function POST(request: Request) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
	}
	const parsed = bodySchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid pairing code." },
			{ status: 400 }
		);
	}
	const deviceId = await deviceIdFromRequest(request);
	if (!deviceId) {
		return NextResponse.json({ error: "Unknown device." }, { status: 401 });
	}
	if (!takeDeviceSlot(deviceId)) {
		return NextResponse.json({ error: "Rate limited." }, { status: 429 });
	}
	try {
		const claimed = await withDeviceDb(deviceId, (db) =>
			claimDevice(db, deviceId, parsed.data.code)
		);
		return NextResponse.json({
			claimed: true,
			userId: claimed.userId,
		});
	} catch (error) {
		if (error instanceof PairingError) {
			return NextResponse.json(
				{ error: error.message, code: error.code },
				{ status: error.status }
			);
		}
		return NextResponse.json(
			{ error: "Could not claim this device." },
			{ status: 500 }
		);
	}
}
