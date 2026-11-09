import { afterEach, describe, expect, it } from "vitest";
import { getOperatorDefault } from "./env";

describe("getOperatorDefault", () => {
	afterEach(() => {
		// biome-ignore lint/performance/noDelete: restore missing env between tests
		delete process.env.MATI_OPERATOR_LLM_PROVIDER;
		// biome-ignore lint/performance/noDelete: restore missing env between tests
		delete process.env.MATI_OPERATOR_LLM_MODEL;
		// biome-ignore lint/performance/noDelete: restore missing env between tests
		delete process.env.MATI_OPERATOR_LLM_API_KEY;
		// biome-ignore lint/performance/noDelete: restore missing env between tests
		delete process.env.BODHA_OPERATOR_LLM_PROVIDER;
		// biome-ignore lint/performance/noDelete: restore missing env between tests
		delete process.env.BODHA_OPERATOR_LLM_MODEL;
		// biome-ignore lint/performance/noDelete: restore missing env between tests
		delete process.env.BODHA_OPERATOR_LLM_API_KEY;
		// biome-ignore lint/performance/noDelete: restore missing env between tests
		delete process.env.MATI_OPERATOR_LLM_BASE_URL;
	});

	it("returns provider, model, and key without a base URL", () => {
		process.env.MATI_OPERATOR_LLM_PROVIDER = "openai";
		process.env.MATI_OPERATOR_LLM_MODEL = "gpt-4.1";
		process.env.MATI_OPERATOR_LLM_API_KEY = "sk-test-sentinel";
		process.env.MATI_OPERATOR_LLM_BASE_URL = "https://evil.example";
		expect(getOperatorDefault()).toEqual({
			provider: "openai",
			model: "gpt-4.1",
			apiKey: "sk-test-sentinel",
			source: "operator_default",
		});
		expect(getOperatorDefault()).not.toHaveProperty("baseUrl");
	});

	it("ignores BODHA_* operator vars and unknown providers", () => {
		process.env.BODHA_OPERATOR_LLM_PROVIDER = "openai";
		process.env.BODHA_OPERATOR_LLM_MODEL = "gpt-4.1";
		process.env.BODHA_OPERATOR_LLM_API_KEY = "sk-test-sentinel";
		expect(getOperatorDefault()).toBeNull();
		process.env.MATI_OPERATOR_LLM_PROVIDER = "openrouter";
		process.env.MATI_OPERATOR_LLM_MODEL = "gpt-4.1";
		process.env.MATI_OPERATOR_LLM_API_KEY = "sk-test-sentinel";
		expect(getOperatorDefault()).toBeNull();
	});
});
