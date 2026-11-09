import { describe, expect, it } from "vitest";
import { takeDeviceSlot } from "./rate-limit";

describe("capture rate limit", () => {
	it("allows 60 requests then rejects in the same minute", () => {
		const deviceId = `rate-${Date.now()}`;
		const start = 1_700_000_000_000;
		for (let i = 0; i < 60; i += 1) {
			expect(takeDeviceSlot(deviceId, start + i)).toBe(true);
		}
		expect(takeDeviceSlot(deviceId, start + 60)).toBe(false);
		expect(takeDeviceSlot(deviceId, start + 60_000)).toBe(true);
	});
});
