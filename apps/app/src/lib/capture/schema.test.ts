import { describe, expect, it } from "vitest";
import { consentSchema, ingestBatchSchema } from "./schema";

describe("capture schemas", () => {
	it("rejects empty consent and oversized batches", () => {
		expect(
			consentSchema.safeParse({
				version: 1,
				grantedAt: "2026-11-09T00:00:00.000Z",
				scopes: [],
			}).success
		).toBe(false);
		expect(
			ingestBatchSchema.safeParse({
				editor: "cursor",
				editorTaskId: "conv-1",
				workspaceHash: "abc",
				events: Array.from({ length: 101 }, (_, index) => ({
					idempotencyKey: `k${index}`,
					kind: "prompt",
					occurredAt: "2026-11-09T00:00:00.000Z",
					text: "x",
				})),
			}).success
		).toBe(false);
	});
});
