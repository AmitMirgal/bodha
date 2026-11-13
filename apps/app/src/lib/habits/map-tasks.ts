import type { HabitPrompt, HabitTask } from "./types";

export interface CaptureHabitRow {
	device: { claimedUserId: string | null };
	events: Array<{
		id: string;
		kind: string;
		occurredAt: Date | string;
		payload: unknown;
	}>;
	finishedAt: Date | string | null;
	id: string;
	reportOpens?: Array<{ openedAt: Date | string }>;
	startedAt: Date | string;
	status: string;
	userId: string | null;
}

function iso(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : value;
}

function promptFromPayload(payload: unknown): string {
	if (
		payload &&
		typeof payload === "object" &&
		"text" in payload &&
		typeof payload.text === "string"
	) {
		return payload.text;
	}
	return "";
}

export function mapCaptureHabitTasks(
	rows: CaptureHabitRow[],
	userId: string
): HabitTask[] {
	return rows.map((row) => {
		const prompts: HabitPrompt[] = row.events
			.filter((event) => event.kind === "prompt")
			.map((event) => ({
				id: event.id,
				occurredAt: iso(event.occurredAt),
				text: promptFromPayload(event.payload),
			}));
		const openedAt = row.reportOpens?.[0]?.openedAt ?? null;
		return {
			claimedByUser:
				row.device.claimedUserId === userId && row.userId === userId,
			finishedAt: row.finishedAt ? iso(row.finishedAt) : null,
			id: row.id,
			prompts,
			reportOpenedAt: openedAt ? iso(openedAt) : null,
			startedAt: iso(row.startedAt),
			status: row.status,
		};
	});
}
