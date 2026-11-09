import { NextResponse } from "next/server";
import { withRequestDevice } from "../../../../../lib/capture/auth";
import { listDeviceTasks } from "../../../../../lib/capture/ingest";

export async function GET(request: Request) {
	try {
		const tasks = await withRequestDevice(request, (db, deviceId) =>
			listDeviceTasks(db, deviceId)
		);
		if (!tasks) {
			return NextResponse.json({ error: "Unknown device." }, { status: 401 });
		}
		return NextResponse.json({ tasks });
	} catch {
		return NextResponse.json(
			{ error: "Could not list tasks." },
			{ status: 500 }
		);
	}
}
