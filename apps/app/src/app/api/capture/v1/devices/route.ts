import { NextResponse } from "next/server";
import { withRequestDevice } from "../../../../../lib/capture/auth";
import { consentSchema } from "../../../../../lib/capture/schema";
import {
	generateDeviceSecret,
	hashDeviceSecret,
} from "../../../../../lib/capture/token";
import {
	captureViewerSecret,
	signViewerToken,
} from "../../../../../lib/capture/viewer";
import { withCaptureRegisterDb } from "../../../../../lib/db/client";
import { toInputJson } from "../../../../../lib/db/queries";

export async function POST(request: Request) {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
	}
	const parsed = consentSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid consent." }, { status: 400 });
	}
	const viewerSecret = captureViewerSecret();
	if (!viewerSecret) {
		return NextResponse.json(
			{ error: "Capture viewer secret is not configured." },
			{ status: 503 }
		);
	}
	const secret = generateDeviceSecret();
	const tokenHash = hashDeviceSecret(secret);
	try {
		const device = await withCaptureRegisterDb((db) =>
			db.device.create({
				data: {
					tokenHash,
					consent: toInputJson(parsed.data),
				},
				select: { id: true },
			})
		);
		const origin = new URL(request.url).origin;
		const viewer = signViewerToken(device.id, viewerSecret);
		return NextResponse.json({
			deviceId: device.id,
			secret,
			viewerUrl: `${origin}/capture/d/${device.id}?v=${viewer}`,
		});
	} catch {
		return NextResponse.json(
			{ error: "Could not register device." },
			{ status: 500 }
		);
	}
}

export async function GET(request: Request) {
	const viewerSecret = captureViewerSecret();
	if (!viewerSecret) {
		return NextResponse.json(
			{ error: "Capture viewer secret is not configured." },
			{ status: 503 }
		);
	}
	try {
		const result = await withRequestDevice(request, (_db, deviceId) => {
			const origin = new URL(request.url).origin;
			return Promise.resolve({
				deviceId,
				viewerUrl: `${origin}/capture/d/${deviceId}?v=${signViewerToken(deviceId, viewerSecret)}`,
			});
		});
		if (!result) {
			return NextResponse.json({ error: "Unknown device." }, { status: 401 });
		}
		return NextResponse.json(result);
	} catch {
		return NextResponse.json(
			{ error: "Could not mint viewer URL." },
			{ status: 500 }
		);
	}
}
