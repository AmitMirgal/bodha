import { NextResponse } from "next/server";
import { logCaptureRouteError } from "../../../../../../lib/capture/log-route-error";
import { listClaimedDevices } from "../../../../../../lib/capture/pair";
import { withUserDb } from "../../../../../../lib/db/client";
import { requireUser } from "../../../../../../lib/supabase/server";

export async function GET() {
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	try {
		const devices = await withUserDb(userId, (db) =>
			listClaimedDevices(db, userId)
		);
		return NextResponse.json({
			devices: devices.map((device) => ({
				createdAt: device.createdAt.toISOString(),
				id: device.id,
			})),
		});
	} catch (error) {
		logCaptureRouteError("GET /api/capture/v1/account/devices", error);
		return NextResponse.json(
			{ error: "Could not list claimed devices." },
			{ status: 500 }
		);
	}
}
