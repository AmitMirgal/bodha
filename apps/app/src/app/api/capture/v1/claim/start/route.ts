import { NextResponse } from "next/server";
import { withRequestDevice } from "../../../../../../lib/capture/auth";
import { startDeviceClaim } from "../../../../../../lib/capture/device-claim";
import { logCaptureRouteError } from "../../../../../../lib/capture/log-route-error";
import { takeDeviceSlot } from "../../../../../../lib/capture/rate-limit";

export async function POST(request: Request) {
	try {
		const result = await withRequestDevice(request, async (db, deviceId) => {
			if (!takeDeviceSlot(deviceId)) {
				return { error: "Rate limited." as const, status: 429 };
			}
			const started = await startDeviceClaim(db, deviceId);
			return { started };
		});
		if (!result) {
			return NextResponse.json({ error: "Unknown device." }, { status: 401 });
		}
		if ("error" in result) {
			return NextResponse.json(
				{ error: result.error },
				{ status: result.status }
			);
		}
		return NextResponse.json(result.started);
	} catch (error) {
		logCaptureRouteError("POST /api/capture/v1/claim/start", error);
		return NextResponse.json(
			{ error: "Could not start a device claim." },
			{ status: 500 }
		);
	}
}
