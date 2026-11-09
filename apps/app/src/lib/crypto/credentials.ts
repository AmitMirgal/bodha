import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
} from "node:crypto";
import { matiEnv } from "../mati-env";

const ALGO = "aes-256-gcm";
const HEX_KEY = /^[0-9a-fA-F]{64}$/;

export class EncryptionConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "EncryptionConfigError";
	}
}

export function getEncryptionKey(): Buffer {
	const raw = matiEnv("CREDENTIALS_ENCRYPTION_KEY");
	if (!raw) {
		throw new EncryptionConfigError(
			"MATI_CREDENTIALS_ENCRYPTION_KEY is not set. Refusing to store or read credentials."
		);
	}
	if (HEX_KEY.test(raw)) {
		return Buffer.from(raw, "hex");
	}
	try {
		const decoded = Buffer.from(raw, "base64");
		if (decoded.length === 32) {
			return decoded;
		}
	} catch {
		// fall through
	}
	throw new EncryptionConfigError(
		"MATI_CREDENTIALS_ENCRYPTION_KEY must be 32 bytes as 64 hex chars or base64."
	);
}

export function encryptionAvailable(): boolean {
	try {
		getEncryptionKey();
		return true;
	} catch {
		return false;
	}
}

export interface EncryptedSecret {
	ciphertext: string;
	fingerprint: string;
	iv: string;
	tag: string;
}

export interface CredentialBinding {
	baseUrl: string;
	model: string;
	provider: string;
}

export function credentialAad(
	ownerId: string,
	binding: CredentialBinding
): Buffer {
	return Buffer.from(
		`${ownerId}\0${binding.provider}\0${binding.model}\0${binding.baseUrl}`,
		"utf8"
	);
}

export function fingerprintKey(plaintext: string): string {
	const digest = createHash("sha256").update(plaintext).digest("hex");
	return `sha256:${digest.slice(0, 8)}…${digest.slice(-4)}`;
}

export function encryptSecret(
	plaintext: string,
	ownerId: string,
	binding: CredentialBinding
): EncryptedSecret {
	if (!plaintext) {
		throw new Error("API key is required.");
	}
	const key = getEncryptionKey();
	const iv = randomBytes(12);
	const cipher = createCipheriv(ALGO, key, iv);
	cipher.setAAD(credentialAad(ownerId, binding));
	const encrypted = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();
	return {
		ciphertext: encrypted.toString("base64"),
		iv: iv.toString("base64"),
		tag: tag.toString("base64"),
		fingerprint: fingerprintKey(plaintext),
	};
}

export function decryptSecret(
	secret: EncryptedSecret,
	ownerId: string,
	binding: CredentialBinding
): string {
	const key = getEncryptionKey();
	const decipher = createDecipheriv(
		ALGO,
		key,
		Buffer.from(secret.iv, "base64")
	);
	decipher.setAAD(credentialAad(ownerId, binding));
	decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
	const decrypted = Buffer.concat([
		decipher.update(Buffer.from(secret.ciphertext, "base64")),
		decipher.final(),
	]);
	return decrypted.toString("utf8");
}
