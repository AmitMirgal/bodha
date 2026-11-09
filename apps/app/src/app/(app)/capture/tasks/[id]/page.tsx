import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { assembleEditorLearningReport } from "../../../../../lib/capture/report";
import { usageCopy } from "../../../../../lib/capture/usage-copy";
import { withUserDb } from "../../../../../lib/db/client";
import { asInt, isoRequired } from "../../../../../lib/db/rows";
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
				usage: true,
			},
			where: { id, userId },
		});
		if (!task) {
			return null;
		}
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
		const assembled = assembleEditorLearningReport({
			taskId: task.id,
			events,
			usage,
		});
		return { assembled, editor: task.editor, editorTaskId: task.editorTaskId };
	});
	if (!loaded) {
		notFound();
	}
	const report = loaded.assembled.ok ? loaded.assembled.report : null;
	const editorUsage = report?.usage.editor;
	return (
		<main className="mx-auto grid max-w-3xl gap-4 px-4 py-8">
			<h1 className="font-semibold text-2xl">
				{loaded.editor} · {loaded.editorTaskId}
			</h1>
			<p className="text-sm">
				{usageCopy(
					editorUsage
						? {
								cachedTokens: editorUsage.cachedTokens,
								inputTokens: editorUsage.inputTokens,
								outputTokens: editorUsage.outputTokens,
								provenance: editorUsage.provenance,
								reasoningTokens: editorUsage.reasoningTokens ?? null,
								source: editorUsage.source,
							}
						: null,
					loaded.editor
				)}
			</p>
			{report ? (
				<>
					<p>{report.summary}</p>
					<p className="text-sm">
						<strong>Outcome:</strong> {report.outcome.observed}
					</p>
					<p className="text-muted-foreground text-sm">
						{report.outcome.verification} (
						{report.outcome.verificationProvenance})
					</p>
					{report.suggestions.map((suggestion) => (
						<section className="grid gap-1" key={suggestion.title}>
							<h2 className="font-medium">{suggestion.title}</h2>
							<p>
								<strong>Improved example:</strong> {suggestion.improvedExample}
							</p>
							<p>
								<strong>Why it helps:</strong> {suggestion.whyItHelps}
							</p>
						</section>
					))}
				</>
			) : (
				<p>
					Could not assemble a learning report from the stored capture rows.
				</p>
			)}
		</main>
	);
}
