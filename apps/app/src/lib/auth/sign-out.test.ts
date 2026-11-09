import { describe, expect, it, vi } from "vitest";
import { SIGN_OUT_PATH, signOutRequest } from "./sign-out";

describe("signOutRequest", () => {
	it("POSTs to the existing sign-out route", async () => {
		const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
		await signOutRequest(fetchImpl);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(fetchImpl).toHaveBeenCalledWith(SIGN_OUT_PATH, { method: "POST" });
		expect(SIGN_OUT_PATH).toBe("/api/auth/sign-out");
	});
});
