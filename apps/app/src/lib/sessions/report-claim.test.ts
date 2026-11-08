import { describe, expect, it } from "vitest";
import { REPORT_STALE_MS, reportClaimDecision } from "./report-claim";

describe("reportClaimDecision", () => {
	it("replays a complete report instead of starting another billed run", () => {
		expect(
			reportClaimDecision({
				status: "complete",
				created_at: new Date().toISOString(),
			}),
		).toEqual({ action: "replay" });
	});

	it("keeps a fresh running claim in-flight", () => {
		expect(
			reportClaimDecision({
				status: "running",
				created_at: new Date().toISOString(),
			}),
		).toEqual({ action: "in_flight" });
	});

	it("expires a stale running claim so a new version can start", () => {
		expect(
			reportClaimDecision(
				{
					status: "running",
					created_at: new Date(Date.now() - REPORT_STALE_MS - 1).toISOString(),
				},
				Date.now(),
			),
		).toEqual({ action: "expire_then_create" });
	});

	it("allows a new version after failed or incomplete reports", () => {
		expect(
			reportClaimDecision({
				status: "failed",
				created_at: new Date().toISOString(),
			}),
		).toEqual({ action: "create" });
		expect(
			reportClaimDecision({
				status: "incomplete",
				created_at: new Date().toISOString(),
			}),
		).toEqual({ action: "create" });
	});
});
