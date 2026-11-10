import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listDeviceTasks } from "../../../../lib/capture/ingest";
import { preferredUsage, usageCopy } from "../../../../lib/capture/usage-copy";
import {
	captureViewerSecret,
	verifyViewerToken,
} from "../../../../lib/capture/viewer";
import { withDeviceDb } from "../../../../lib/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Mati capture",
};

export default async function CaptureViewerPage({
	params,
	searchParams,
}: {
	params: Promise<{ deviceId: string }>;
	searchParams: Promise<{ v?: string }>;
}) {
	const { deviceId } = await params;
	const { v } = await searchParams;
	const secret = captureViewerSecret();
	if (!(secret && v && verifyViewerToken(deviceId, v, secret))) {
		notFound();
	}
	const tasks = await withDeviceDb(deviceId, (db) =>
		listDeviceTasks(db, deviceId)
	);
	return (
		<main className="mx-auto grid max-w-3xl gap-8 px-4 py-10">
			<h1 className="font-semibold text-3xl tracking-tight">
				Your editor tasks
			</h1>
			<p className="text-muted-foreground">
				This view is tied to this device. It is not a Mati account. Cursor hooks
				do not report vendor token counts. Any number below is a labelled
				text-length estimate and undercounts.
			</p>
			{tasks.length === 0 ? (
				<p>No captured Agent prompts yet.</p>
			) : (
				tasks.map((task) => (
					<section
						className="grid gap-2 rounded-xl border bg-card p-4"
						key={task.id}
					>
						<h2 className="font-medium">
							{task.editor} · {task.status}
						</h2>
						<p className="text-muted-foreground text-sm">
							Conversation {task.editorTaskId}
						</p>
						<p className="text-sm">{usageCopy(preferredUsage(task.usage))}</p>
						<h3 className="text-sm">Prompts</h3>
						{task.prompts.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								No prompts stored for this task.
							</p>
						) : (
							<ul className="grid gap-2">
								{task.prompts.map((prompt) => (
									<li
										className="whitespace-pre-wrap rounded-md bg-muted px-3 py-2 font-mono text-sm"
										key={`${task.id}:${prompt}`}
									>
										{prompt}
									</li>
								))}
							</ul>
						)}
						{task.filePaths.length > 0 ? (
							<p className="text-muted-foreground text-sm">
								Edited files: {task.filePaths.join(", ")}
							</p>
						) : null}
					</section>
				))
			)}
		</main>
	);
}
