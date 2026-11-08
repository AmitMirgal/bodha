import { afterEach, describe, expect, it } from "vitest";
import {
	decryptSecret,
	EncryptionConfigError,
	encryptSecret,
	getEncryptionKey,
} from "./credentials";

const KEY = "0".repeat(64);

describe("credential encryption", () => {
	afterEach(() => {
		delete process.env.BODHA_CREDENTIALS_ENCRYPTION_KEY;
	});

	it("fails closed without an encryption key", () => {
		expect(() => getEncryptionKey()).toThrow(EncryptionConfigError);
	});

	it("round-trips a secret bound to the owner", () => {
		process.env.BODHA_CREDENTIALS_ENCRYPTION_KEY = KEY;
		const encrypted = encryptSecret(
			"sk-test-sentinel",
			"11111111-1111-1111-1111-111111111111",
		);
		expect(encrypted.ciphertext).not.toContain("sk-test-sentinel");
		const plain = decryptSecret(
			encrypted,
			"11111111-1111-1111-1111-111111111111",
		);
		expect(plain).toBe("sk-test-sentinel");
	});

	it("rejects cross-user decryption", () => {
		process.env.BODHA_CREDENTIALS_ENCRYPTION_KEY = KEY;
		const encrypted = encryptSecret(
			"sk-test-sentinel",
			"11111111-1111-1111-1111-111111111111",
		);
		expect(() =>
			decryptSecret(encrypted, "22222222-2222-2222-2222-222222222222"),
		).toThrow();
	});
});
