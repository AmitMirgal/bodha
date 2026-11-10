import { NextResponse } from "next/server";
import { withRequestDevice } from "../../../../../lib/capture/auth";
import { listDeviceTasks } from "../../../../../lib/capture/ingest";
import { logCaptureRouteError } from "../../../../../lib/capture/log-route-error";

export async function GET(request: Request) {
	try {
		const tasks = await withRequestDevice(request, (db, deviceId) =>
			listDeviceTasks(db, deviceId)
		);
		if (!tasks) {
			return NextResponse.json({ error: "Unknown device." }, { status: 401 });
		}
		return NextResponse.json({ tasks });
	} catch (error) {
		logCaptureRouteError("GET /api/capture/v1/tasks", error);
		return NextResponse.json(
			{ error: "Could not list tasks." },
			{ status: 500 }
		);
	}
}
