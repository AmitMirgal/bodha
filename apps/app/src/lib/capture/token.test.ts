import { describe, expect, it } from "vitest";
import {
	DEVICE_TOKEN_PREFIX,
	generateDeviceSecret,
	hashDeviceSecret,
	parseDeviceBearer,
} from "./token";

describe("device token", () => {
	it("mints a 32-byte hex secret with the documented prefix", () => {
		const secret = generateDeviceSecret();
		expect(secret.startsWith(DEVICE_TOKEN_PREFIX)).toBe(true);
		expect(secret).toMatch(/^mati_dev_[0-9a-f]{64}$/);
		expect(hashDeviceSecret(secret)).toMatch(/^[0-9a-f]{64}$/);
		expect(hashDeviceSecret(secret)).toBe(hashDeviceSecret(secret));
	});

	it("accepts only a Bearer mati_dev_ token", () => {
		const secret = generateDeviceSecret();
		expect(parseDeviceBearer(`Bearer ${secret}`)).toBe(secret);
		expect(parseDeviceBearer(`bearer ${secret}`)).toBe(secret);
		expect(parseDeviceBearer(secret)).toBeNull();
		expect(parseDeviceBearer("Bearer mati_dev_zzzz")).toBeNull();
		expect(parseDeviceBearer(null)).toBeNull();
	});
});
