import { afterEach, describe, expect, it } from "vitest";
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
		// biome-ignore lint/performance/noDelete: restore missing env between tests
		delete process.env.MATI_CREDENTIALS_ENCRYPTION_KEY;
		// biome-ignore lint/performance/noDelete: restore missing env between tests
		delete process.env.BODHA_CREDENTIALS_ENCRYPTION_KEY;
	});

	it("fails closed without an encryption key", () => {
		expect(() => getEncryptionKey()).toThrow(EncryptionConfigError);
	});

	it("does not read BODHA_* encryption keys", () => {
		process.env.BODHA_CREDENTIALS_ENCRYPTION_KEY = KEY;
		expect(() => getEncryptionKey()).toThrow(EncryptionConfigError);
	});

	it("round-trips a secret bound to owner, provider, and model", () => {
		process.env.MATI_CREDENTIALS_ENCRYPTION_KEY = KEY;
		const encrypted = encryptSecret("sk-test-sentinel", OWNER, BINDING);
		expect(encrypted.ciphertext).not.toContain("sk-test-sentinel");
		expect(decryptSecret(encrypted, OWNER, BINDING)).toBe("sk-test-sentinel");
	});

	it("rejects cross-user decryption", () => {
		process.env.MATI_CREDENTIALS_ENCRYPTION_KEY = KEY;
		const encrypted = encryptSecret("sk-test-sentinel", OWNER, BINDING);
		expect(() =>
			decryptSecret(encrypted, "22222222-2222-4222-8222-222222222222", BINDING)
		).toThrow();
	});

	it("rejects provider or model binding swaps", () => {
		process.env.MATI_CREDENTIALS_ENCRYPTION_KEY = KEY;
		const encrypted = encryptSecret("sk-test-sentinel", OWNER, BINDING);
		expect(() =>
			decryptSecret(encrypted, OWNER, { ...BINDING, provider: "anthropic" })
		).toThrow();
		expect(() =>
			decryptSecret(encrypted, OWNER, { ...BINDING, model: "other-model" })
		).toThrow();
	});
});
