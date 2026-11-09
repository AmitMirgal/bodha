import { preferredUsage, usageCopy } from "./usage-copy";

export interface CaptureViewerTask {
	editor: string;
	editorTaskId: string;
	filePaths: string[];
	id: string;
	prompts: string[];
	status: string;
	usage: Array<{
		cachedTokens: number | null;
		inputTokens: number | null;
		outputTokens: number | null;
		provenance: string;
		reasoningTokens?: number | null;
		source: string;
	}>;
}

export function captureViewerDocument(tasks: CaptureViewerTask[]): string {
	const hasMeasured = tasks.some(
		(task) => preferredUsage(task.usage)?.provenance === "measured"
	);
	const intro = hasMeasured
		? "Copilot Chat token counts below are vendor-reported from OpenTelemetry chat spans. Cursor hooks still have no vendor counts; any Cursor estimate is labelled and undercounts."
		: "This view is tied to this device. It is not a Mati account. Cursor hooks do not report vendor token counts. Any number below is a labelled text-length estimate and undercounts.";
	const body =
		tasks.length === 0
			? "<p>No captured Agent prompts yet.</p>"
			: tasks
					.map((task) => {
						const prompts =
							task.prompts.length === 0
								? `<p class="muted">No prompts stored for this task.</p>`
								: `<ul>${task.prompts
										.map(
											(prompt) =>
												`<li class="prompt">${escapeHtml(prompt)}</li>`
										)
										.join("")}</ul>`;
						const files =
							task.filePaths.length === 0
								? ""
								: `<p class="muted">Edited files: ${escapeHtml(task.filePaths.join(", "))}</p>`;
						return `<section class="task">
<h2>${escapeHtml(task.editor)} · ${escapeHtml(task.status)}</h2>
<p class="muted">Conversation ${escapeHtml(task.editorTaskId)}</p>
<p>${escapeHtml(usageCopy(preferredUsage(task.usage), task.editor))}</p>
<h3>Prompts</h3>
${prompts}
${files}
</section>`;
					})
					.join("");
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Mati capture</title>
<style>
body{font-family:ui-sans-serif,system-ui,sans-serif;margin:0;background:#fafafa;color:#111}
main{max-width:48rem;margin:0 auto;padding:2rem 1rem;display:grid;gap:1rem}
h1{font-size:1.5rem;margin:0}
h2,h3{margin:0 0 .5rem}
.muted{color:#555}
.task{border:1px solid #ddd;border-radius:1rem;background:#fff;padding:1rem}
.prompt{font-family:ui-monospace,monospace;background:#f3f3f3;padding:.5rem .75rem;border-radius:.5rem;white-space:pre-wrap}
ul{list-style:none;padding:0;margin:0;display:grid;gap:.5rem}
</style>
</head>
<body>
<main>
<h1>Your editor tasks</h1>
<p class="muted">${escapeHtml(intro)}</p>
${body}
</main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}
