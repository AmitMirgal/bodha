import { describe, expect, it } from "vitest";
import {
	captureViewerSecret,
	signViewerToken,
	verifyViewerToken,
} from "./viewer";

const SECRET = "ab".repeat(32);
const DEVICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("capture viewer HMAC", () => {
	it("requires 64 hex chars", () => {
		expect(captureViewerSecret({ MATI_CAPTURE_VIEWER_SECRET: SECRET })).toBe(
			SECRET
		);
		expect(
			captureViewerSecret({ MATI_CAPTURE_VIEWER_SECRET: "short" })
		).toBeNull();
		expect(
			captureViewerSecret({ BODHA_CAPTURE_VIEWER_SECRET: SECRET })
		).toBeNull();
	});

	it("rejects expired or swapped tokens", () => {
		const token = signViewerToken(DEVICE, SECRET, 1000);
		expect(verifyViewerToken(DEVICE, token, SECRET, 1000)).toBe(true);
		expect(
			verifyViewerToken(DEVICE, token, SECRET, 1000 + 8 * 24 * 60 * 60 * 1000)
		).toBe(false);
		expect(
			verifyViewerToken(
				"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
				token,
				SECRET,
				1000
			)
		).toBe(false);
		expect(verifyViewerToken(DEVICE, "nope", SECRET, 1000)).toBe(false);
	});
});
