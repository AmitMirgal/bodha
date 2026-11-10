import { NextResponse } from "next/server";
import { logCaptureRouteError } from "../../../../../../../lib/capture/log-route-error";
import { deleteClaimedDevice } from "../../../../../../../lib/capture/pair";
import { withUserDb } from "../../../../../../../lib/db/client";
import { requireUser } from "../../../../../../../lib/supabase/server";

const UUID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(
	_request: Request,
	context: { params: Promise<{ id: string }> }
) {
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	const { id } = await context.params;
	if (!UUID.test(id)) {
		return NextResponse.json({ error: "Unknown device." }, { status: 404 });
	}
	try {
		const deleted = await withUserDb(userId, (db) =>
			deleteClaimedDevice(db, userId, id)
		);
		if (!deleted) {
			return NextResponse.json({ error: "Unknown device." }, { status: 404 });
		}
		return NextResponse.json({ deleted: true, deviceId: id });
	} catch (error) {
		logCaptureRouteError("DELETE /api/capture/v1/account/devices/[id]", error);
		return NextResponse.json(
			{ error: "Could not delete editor capture for this device." },
			{ status: 500 }
		);
	}
}
