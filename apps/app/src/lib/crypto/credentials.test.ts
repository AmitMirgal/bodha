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
	baseUrl: "https://api.openai.com/v1",
};

describe("credential encryption", () => {
	afterEach(() => {
		delete process.env.BODHA_CREDENTIALS_ENCRYPTION_KEY;
	});

	it("fails closed without an encryption key", () => {
		expect(() => getEncryptionKey()).toThrow(EncryptionConfigError);
	});

	it("round-trips a secret bound to owner and provider config", () => {
		process.env.BODHA_CREDENTIALS_ENCRYPTION_KEY = KEY;
		const encrypted = encryptSecret("sk-test-sentinel", OWNER, BINDING);
		expect(encrypted.ciphertext).not.toContain("sk-test-sentinel");
		expect(decryptSecret(encrypted, OWNER, BINDING)).toBe("sk-test-sentinel");
	});

	it("rejects cross-user decryption", () => {
		process.env.BODHA_CREDENTIALS_ENCRYPTION_KEY = KEY;
		const encrypted = encryptSecret("sk-test-sentinel", OWNER, BINDING);
		expect(() =>
			decryptSecret(encrypted, "22222222-2222-4222-8222-222222222222", BINDING),
		).toThrow();
	});

	it("rejects provider or endpoint binding swaps", () => {
		process.env.BODHA_CREDENTIALS_ENCRYPTION_KEY = KEY;
		const encrypted = encryptSecret("sk-test-sentinel", OWNER, BINDING);
		expect(() =>
			decryptSecret(encrypted, OWNER, { ...BINDING, provider: "openrouter" }),
		).toThrow();
		expect(() =>
			decryptSecret(encrypted, OWNER, {
				...BINDING,
				baseUrl: "https://openrouter.ai/api/v1",
			}),
		).toThrow();
		expect(() =>
			decryptSecret(encrypted, OWNER, { ...BINDING, model: "other-model" }),
		).toThrow();
	});
});
