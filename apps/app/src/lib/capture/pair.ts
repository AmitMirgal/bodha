import { createHash, randomBytes } from "node:crypto";
import type { MatiDb } from "../db/rls";

export const PAIRING_TTL_MS = 10 * 60 * 1000;
export const UNCLAIMED_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class PairingError extends Error {
	code: string;
	status: number;
	constructor(message: string, status: number, code: string) {
		super(message);
		this.name = "PairingError";
		this.status = status;
		this.code = code;
	}
}

export function hashPairingCode(code: string): string {
	return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

export function generatePairingCode(): string {
	const bytes = randomBytes(8);
	return [...bytes].map((byte) => ALPHABET[byte % 32]).join("");
}

export async function startPairing(
	db: MatiDb,
	userId: string,
	now = new Date()
): Promise<{ code: string; expiresAt: string }> {
	await db.pairingCode.updateMany({
		data: { consumedAt: now },
		where: { consumedAt: null, userId },
	});
	const code = generatePairingCode();
	const expiresAt = new Date(now.getTime() + PAIRING_TTL_MS);
	await db.pairingCode.create({
		data: {
			codeHash: hashPairingCode(code),
			expiresAt,
			userId,
		},
	});
	return { code, expiresAt: expiresAt.toISOString() };
}

export async function claimDevice(
	db: MatiDb,
	deviceId: string,
	code: string
): Promise<{ userId: string }> {
	const codeHash = hashPairingCode(code);
	const device = await db.device.findFirst({
		select: { claimedUserId: true },
		where: { id: deviceId },
	});
	if (!device) {
		throw new PairingError("Unknown device.", 401, "unknown_device");
	}
	if (device.claimedUserId) {
		throw new PairingError(
			"This device is already linked to a Mati account.",
			409,
			"already_claimed"
		);
	}
	const consumed = await db.$queryRaw<Array<{ user_id: string | null }>>`
    SELECT public.mati_consume_pairing_code(${codeHash})::text AS user_id`;
	const userId = consumed[0]?.user_id;
	if (!userId) {
		throw new PairingError(
			"That pairing code is invalid or expired.",
			400,
			"invalid_code"
		);
	}
	await db.device.update({
		data: { claimedUserId: userId },
		where: { id: deviceId },
	});
	await db.captureTask.updateMany({
		data: { userId },
		where: { deviceId },
	});
	await db.captureEvent.updateMany({
		data: { userId },
		where: { deviceId },
	});
	await db.captureUsage.updateMany({
		data: { userId },
		where: { deviceId },
	});
	return { userId };
}

export async function deleteOwnDevice(
	db: MatiDb,
	deviceId: string
): Promise<void> {
	await db.device.delete({ where: { id: deviceId } });
}

export async function deleteClaimedDevice(
	db: MatiDb,
	userId: string,
	deviceId: string
): Promise<boolean> {
	const result = await db.device.deleteMany({
		where: { claimedUserId: userId, id: deviceId },
	});
	return result.count > 0;
}

export async function listClaimedDevices(db: MatiDb, userId: string) {
	return await db.device.findMany({
		orderBy: { createdAt: "desc" },
		select: { claimedUserId: true, createdAt: true, id: true },
		where: { claimedUserId: userId },
	});
}

export async function sweepUnclaimedDevices(
	db: MatiDb,
	now = new Date()
): Promise<number> {
	const cutoff = new Date(now.getTime() - UNCLAIMED_TTL_MS);
	await db.captureEvent.deleteMany({
		where: {
			userId: null,
			device: { claimedUserId: null, createdAt: { lt: cutoff } },
		},
	});
	await db.captureUsage.deleteMany({
		where: {
			userId: null,
			device: { claimedUserId: null, createdAt: { lt: cutoff } },
		},
	});
	await db.captureTask.deleteMany({
		where: {
			userId: null,
			device: { claimedUserId: null, createdAt: { lt: cutoff } },
		},
	});
	const result = await db.device.deleteMany({
		where: { claimedUserId: null, createdAt: { lt: cutoff } },
	});
	return result.count;
}
