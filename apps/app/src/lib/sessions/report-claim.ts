export const REPORT_STALE_MS = 3 * 60 * 1000;

export type ReportStatus = "running" | "complete" | "failed" | "incomplete";

export type ReportClaimDecision =
	| { action: "replay" }
	| { action: "in_flight" }
	| { action: "expire_then_create" }
	| { action: "create" };

function asReportStatus(status: string): ReportStatus {
	switch (status) {
		case "running":
		case "complete":
		case "failed":
		case "incomplete":
			return status;
		default: {
			const exhaustive: never = status as never;
			throw new Error(`Unhandled report status: ${String(exhaustive)}`);
		}
	}
}

export function reportClaimDecision(
	existing: { created_at: string; status: string } | null,
	now = Date.now(),
	staleMs = REPORT_STALE_MS
): ReportClaimDecision {
	if (!existing) {
		return { action: "create" };
	}
	const status = asReportStatus(existing.status);
	switch (status) {
		case "complete":
			return { action: "replay" };
		case "running": {
			const created = Date.parse(existing.created_at);
			if (!Number.isFinite(created) || now - created >= staleMs) {
				return { action: "expire_then_create" };
			}
			return { action: "in_flight" };
		}
		case "failed":
		case "incomplete":
			return { action: "create" };
		default: {
			const exhaustive: never = status;
			throw new Error(`Unhandled report status: ${String(exhaustive)}`);
		}
	}
}
