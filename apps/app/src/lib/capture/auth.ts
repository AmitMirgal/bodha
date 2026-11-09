import { withCaptureRegisterDb, withDeviceDb } from "../db/client";
import type { MatiDb } from "../db/rls";
import { hashDeviceSecret, parseDeviceBearer } from "./token";

export async function deviceIdFromRequest(
	request: Request
): Promise<string | null> {
	const secret = parseDeviceBearer(request.headers.get("authorization"));
	if (!secret) {
		return null;
	}
	const tokenHash = hashDeviceSecret(secret);
	return await withCaptureRegisterDb(async (db) => {
		const row = await db.device.findFirst({
			where: { tokenHash },
			select: { id: true },
		});
		return row?.id ?? null;
	});
}

export async function withRequestDevice<T>(
	request: Request,
	fn: (db: MatiDb, deviceId: string) => Promise<T>
): Promise<T | null> {
	const deviceId = await deviceIdFromRequest(request);
	if (!deviceId) {
		return null;
	}
	return await withDeviceDb(deviceId, (db) => fn(db, deviceId));
}
