import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	captureRouteErrorFields,
	logCaptureRouteError,
} from "./log-route-error";

const CAPTURE_V1_ROUTES = [
	"../../app/api/capture/v1/devices/route.ts",
	"../../app/api/capture/v1/events/route.ts",
	"../../app/api/capture/v1/device/route.ts",
	"../../app/api/capture/v1/tasks/route.ts",
	"../../app/api/capture/v1/account/devices/route.ts",
	"../../app/api/capture/v1/account/devices/[id]/route.ts",
	"../../app/api/capture/v1/account/tasks/[id]/report/route.ts",
	"../../app/api/capture/v1/pair/claim/route.ts",
	"../../app/api/capture/v1/pair/start/route.ts",
];

describe("capture route error logging", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("keeps name, code, and message without connection strings or tokens", () => {
		const error = Object.assign(new Error("role capture_register"), {
			code: "42501",
		});
		error.message =
			"permission denied for schema auth postgresql://postgres.example:s3cret@host/db Bearer tok_live_abc sb_secret_xyz";
		const fields = captureRouteErrorFields(error);
		expect(fields.name).toBe("Error");
		expect(fields.code).toBe("42501");
		expect(fields.message).toMatch(/permission denied for schema auth/);
		expect(fields.message).not.toMatch(/postgresql:\/\//);
		expect(fields.message).not.toMatch(/s3cret/);
		expect(fields.message).not.toMatch(/tok_live/);
		expect(fields.message).not.toMatch(/sb_secret_/);
		expect(fields.message).toMatch(/\[redacted\]/);
	});

	it("prints only name/code/message on the server console", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		logCaptureRouteError(
			"POST /api/capture/v1/devices",
			Object.assign(new Error("permission denied for schema auth"), {
				code: "42501",
			})
		);
		expect(spy).toHaveBeenCalledTimes(1);
		const line = String(spy.mock.calls[0]?.[0]);
		expect(line).toBe(
			"[capture] POST /api/capture/v1/devices: Error 42501: permission denied for schema auth"
		);
	});

	it("logs 500s from every capture v1 route", () => {
		for (const relative of CAPTURE_V1_ROUTES) {
			const source = readFileSync(new URL(relative, import.meta.url), "utf8");
			expect(source).toMatch(/logCaptureRouteError/);
		}
	});
});
