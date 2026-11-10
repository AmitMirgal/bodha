import { NextResponse } from "next/server";
import { logCaptureRouteError } from "../../../../../../lib/capture/log-route-error";
import { PairingError, startPairing } from "../../../../../../lib/capture/pair";
import { withUserDb } from "../../../../../../lib/db/client";
import { requireUser } from "../../../../../../lib/supabase/server";

export async function POST() {
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	try {
		const pairing = await withUserDb(userId, (db) => startPairing(db, userId));
		return NextResponse.json(pairing);
	} catch (error) {
		if (error instanceof PairingError) {
			return NextResponse.json(
				{ error: error.message, code: error.code },
				{ status: error.status }
			);
		}
		logCaptureRouteError("POST /api/capture/v1/pair/start", error);
		return NextResponse.json(
			{ error: "Could not create a pairing code." },
			{ status: 500 }
		);
	}
}
