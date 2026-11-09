import { NextResponse } from "next/server";
import { withRequestDevice } from "../../../../../lib/capture/auth";
import { deleteOwnDevice } from "../../../../../lib/capture/pair";

export async function DELETE(request: Request) {
	try {
		const result = await withRequestDevice(request, async (db, deviceId) => {
			await deleteOwnDevice(db, deviceId);
			return { deleted: true as const, deviceId };
		});
		if (!result) {
			return NextResponse.json({ error: "Unknown device." }, { status: 401 });
		}
		return NextResponse.json(result);
	} catch {
		return NextResponse.json(
			{ error: "Could not delete this device." },
			{ status: 500 }
		);
	}
}
