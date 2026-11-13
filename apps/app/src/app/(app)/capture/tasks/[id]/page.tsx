import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProgressTaskDetail } from "../../../../../components/ProgressTaskDetail";
import { withUserDb } from "../../../../../lib/db/client";
import { asInt, iso, isoRequired } from "../../../../../lib/db/rows";
import { PROGRESS_TIMEZONE } from "../../../../../lib/env";
import {
	recordCaptureReportOpen,
	syncHabits,
} from "../../../../../lib/habits/load";
import { taskFromEditor } from "../../../../../lib/progress/view";
import { requireUser } from "../../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Editor task",
};

export default async function CaptureTaskPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { userId } = await requireUser();
	if (!userId) {
		redirect("/login?next=/progress");
	}
	const { id } = await params;
	const loaded = await withUserDb(userId, async (db) => {
		const task = await db.captureTask.findFirst({
			include: {
				events: { orderBy: { occurredAt: "asc" } },
				reports: { orderBy: { version: "desc" }, take: 1 },
				usage: true,
			},
			where: { id, userId },
		});
		if (!task) {
			return null;
		}
		await recordCaptureReportOpen(db, userId, task.id);
		await syncHabits(db, userId, PROGRESS_TIMEZONE);
		const events = task.events.map((event) => ({
			id: event.id,
			kind: event.kind,
			occurredAt: isoRequired(event.occurredAt),
			payload: event.payload,
		}));
		const usage = task.usage.map((row) => ({
			cachedTokens: asInt(row.cachedTokens),
			inputTokens: asInt(row.inputTokens),
			outputTokens: asInt(row.outputTokens),
			provenance: row.provenance,
			reasoningTokens: asInt(row.reasoningTokens),
			source: row.source,
		}));
		return taskFromEditor(
			{
				deviceId: task.deviceId,
				editor: task.editor,
				editorTaskId: task.editorTaskId,
				events,
				finishedAt: iso(task.finishedAt),
				id: task.id,
				prompts: events
					.filter((event) => event.kind === "prompt")
					.map((event) => {
						const payload = event.payload;
						if (
							payload &&
							typeof payload === "object" &&
							"text" in payload &&
							typeof payload.text === "string"
						) {
							return payload.text;
						}
						return "";
					}),
				startedAt: isoRequired(task.startedAt),
				status: task.status,
				storedReport: task.reports[0]
					? {
							body: task.reports[0].body,
							error: task.reports[0].error,
							status: task.reports[0].status,
						}
					: null,
				usage,
			},
			iso(task.finishedAt) ?? isoRequired(task.startedAt)
		);
	});
	if (!loaded) {
		notFound();
	}
	return <ProgressTaskDetail task={loaded} />;
}
