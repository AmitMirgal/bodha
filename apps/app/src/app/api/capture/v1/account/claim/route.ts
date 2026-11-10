import { NextResponse } from "next/server";
import { z } from "zod";
import {
	claimDeviceWithToken,
	requestSameOrigin,
} from "../../../../../../lib/capture/device-claim";
import { logCaptureRouteError } from "../../../../../../lib/capture/log-route-error";
import { PairingError } from "../../../../../../lib/capture/pair";
import { withUserDb } from "../../../../../../lib/db/client";
import { requireUser } from "../../../../../../lib/supabase/server";

const bodySchema = z.object({
	token: z.string().regex(/^[0-9a-f]{64}$/i, "Invalid claim token."),
});

export async function POST(request: Request) {
	if (!requestSameOrigin(request)) {
		return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
	}
	const { userId } = await requireUser();
	if (!userId) {
		return NextResponse.json({ error: "Sign in required." }, { status: 401 });
	}
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
	}
	const parsed = bodySchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid claim token." },
			{ status: 400 }
		);
	}
	try {
		const claimed = await withUserDb(userId, async (db) => {
			const result = await claimDeviceWithToken(db, userId, parsed.data.token);
			const latest = await db.captureTask.findFirst({
				orderBy: { startedAt: "desc" },
				select: { id: true },
				where: { deviceId: result.deviceId, userId },
			});
			return {
				deviceId: result.deviceId,
				redirectTo: latest ? `/capture/tasks/${latest.id}` : "/progress",
			};
		});
		return NextResponse.json(claimed);
	} catch (error) {
		if (error instanceof PairingError) {
			return NextResponse.json(
				{ error: error.message, code: error.code },
				{ status: error.status }
			);
		}
		logCaptureRouteError("POST /api/capture/v1/account/claim", error);
		return NextResponse.json(
			{ error: "Could not link this device." },
			{ status: 500 }
		);
	}
}
