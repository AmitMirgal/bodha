import type { MatiDb } from "../db/rls";
import { iso, isoRequired, usageRow } from "../db/rows";
import type { ProgressSessionInput, ProgressView } from "./types";
import { assembleProgressView } from "./view";

function promptFromEvidence(payload: unknown): string | null {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const record = payload as { content?: unknown; text?: unknown };
	if (typeof record.content === "string" && record.content.trim()) {
		return record.content;
	}
	if (typeof record.text === "string" && record.text.trim()) {
		return record.text;
	}
	return null;
}

export function promptsForSession(
	messages: Array<{ content: string; role: string }>,
	evidence: Array<{ kind: string; payload: unknown }>
): string[] {
	const fromMessages = messages
		.filter((message) => message.role === "user")
		.map((message) => message.content)
		.filter((content) => content.trim().length > 0);
	if (fromMessages.length > 0) {
		return fromMessages;
	}
	return evidence
		.filter((item) => item.kind === "prompt")
		.map((item) => promptFromEvidence(item.payload))
		.filter((item): item is string => item != null);
}

export async function loadProgressView(
	db: MatiDb,
	userId: string,
	timezone: string
): Promise<ProgressView> {
	const rows = await db.session.findMany({
		where: { userId },
		orderBy: { createdAt: "desc" },
		include: {
			messages: { orderBy: { createdAt: "asc" } },
			reports: { orderBy: { version: "desc" }, take: 1 },
			usage: true,
			evidence: {
				where: { kind: "prompt" },
				orderBy: { seq: "asc" },
			},
		},
	});
	const inputs: ProgressSessionInput[] = rows.map((row) => {
		const report = row.reports[0] ?? null;
		return {
			id: row.id,
			exerciseId: row.exerciseId,
			status: row.status,
			createdAt: isoRequired(row.createdAt),
			startedAt: iso(row.startedAt),
			finishedAt: iso(row.finishedAt),
			prompts: promptsForSession(
				row.messages,
				row.evidence.map((item) => ({
					kind: item.kind,
					payload: item.payload,
				}))
			),
			usageRows: row.usage.map(usageRow),
			report: report ? { status: report.status, body: report.body } : null,
		};
	});
	return assembleProgressView(inputs, timezone);
}
