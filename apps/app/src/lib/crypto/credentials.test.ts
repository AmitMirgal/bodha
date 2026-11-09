import { afterEach, describe, expect, it, vi } from "vitest";
import {
	decryptSecret,
	EncryptionConfigError,
	encryptSecret,
	getEncryptionKey,
} from "./credentials";

const KEY = "0".repeat(64);
const OWNER = "11111111-1111-4111-8111-111111111111";
const BINDING = {
	provider: "openai",
	model: "gpt-4.1",
};

describe("credential encryption", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("fails closed without an encryption key", () => {
		vi.stubEnv("MATI_CREDENTIALS_ENCRYPTION_KEY", "");
		expect(() => getEncryptionKey()).toThrow(EncryptionConfigError);
	});

	it("does not read BODHA_* encryption keys", () => {
		vi.stubEnv("MATI_CREDENTIALS_ENCRYPTION_KEY", "");
		vi.stubEnv("BODHA_CREDENTIALS_ENCRYPTION_KEY", KEY);
		expect(() => getEncryptionKey()).toThrow(EncryptionConfigError);
	});

	it("round-trips a secret bound to owner, provider, and model", () => {
		vi.stubEnv("MATI_CREDENTIALS_ENCRYPTION_KEY", KEY);
		const encrypted = encryptSecret("sk-test-sentinel", OWNER, BINDING);
		expect(encrypted.ciphertext).not.toContain("sk-test-sentinel");
		expect(decryptSecret(encrypted, OWNER, BINDING)).toBe("sk-test-sentinel");
	});

	it("rejects cross-user decryption", () => {
		vi.stubEnv("MATI_CREDENTIALS_ENCRYPTION_KEY", KEY);
		const encrypted = encryptSecret("sk-test-sentinel", OWNER, BINDING);
		expect(() =>
			decryptSecret(encrypted, "22222222-2222-4222-8222-222222222222", BINDING)
		).toThrow();
	});

	it("rejects provider or model binding swaps", () => {
		vi.stubEnv("MATI_CREDENTIALS_ENCRYPTION_KEY", KEY);
		const encrypted = encryptSecret("sk-test-sentinel", OWNER, BINDING);
		expect(() =>
			decryptSecret(encrypted, OWNER, { ...BINDING, provider: "anthropic" })
		).toThrow();
		expect(() =>
			decryptSecret(encrypted, OWNER, { ...BINDING, model: "other-model" })
		).toThrow();
	});
});
