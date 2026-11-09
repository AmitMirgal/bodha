import type { ProgressTask, ProgressView } from "./types";
import { usageCopy } from "./view";

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function tokenBarWidth(
	point: {
		measuredInputTokens: number | null;
		measuredOutputTokens: number | null;
	},
	max: number
): string {
	if (max <= 0) {
		return "0%";
	}
	const value =
		(point.measuredInputTokens ?? 0) + (point.measuredOutputTokens ?? 0);
	return `${Math.round((value / max) * 100)}%`;
}

function taskHtml(task: ProgressTask): string {
	const prompts =
		task.prompts.length === 0
			? `<p class="muted">No prompts were stored for this task.</p>`
			: `<ul>${task.prompts
					.map((prompt) => `<li class="prompt">${escapeHtml(prompt)}</li>`)
					.join("")}</ul>`;
	let report = "";
	switch (task.reportStatus) {
		case "none":
			report = `<p class="muted">No learning report yet. Finish the session to generate one.</p>`;
			break;
		case "error":
			report =
				"<p>The learning report did not complete. Session evidence was kept.</p>";
			break;
		case "pending":
			report = `<p class="muted">A learning report is still running.</p>`;
			break;
		case "complete":
			report = "";
			break;
		default: {
			const exhaustive: never = task.reportStatus;
			throw new Error(`Unhandled report status: ${String(exhaustive)}`);
		}
	}
	const outcome = task.outcome
		? `<p><strong>Outcome:</strong> ${escapeHtml(task.outcome.observed)}</p>
<p><strong>Verification:</strong> ${escapeHtml(task.outcome.verification)} (${escapeHtml(task.outcome.verificationProvenance)})</p>
${
	task.tests?.found
		? `<p>Stored test observations: ${task.tests.passed} passed, ${task.tests.failed} failed of ${task.tests.total}.</p>`
		: `<p class="muted">No browser harness run recorded.</p>`
}`
		: "";
	const suggestions =
		task.suggestions.length === 0
			? ""
			: `<h3>Prompt improvements</h3>${task.suggestions
					.map(
						(suggestion) => `<div>
<p class="title">${escapeHtml(suggestion.title)}</p>
<p><strong>Improved example:</strong> ${escapeHtml(suggestion.improvedExample)}</p>
<p><strong>Why it helps:</strong> ${escapeHtml(suggestion.whyItHelps)}</p>
<p class="muted">${suggestion.illustrative ? "Illustrative recommendation" : "Recommendation grounded in stored evidence"}</p>
</div>`
					)
					.join("")}`;
	return `<li class="task">
<p><a href="${escapeHtml(task.reportHref)}">${escapeHtml(task.exerciseId)}</a> · ${escapeHtml(task.status)}</p>
<p>${escapeHtml(usageCopy(task.usage))}</p>
<h3>Prompts</h3>
${prompts}
${report}
${outcome}
${suggestions}
</li>`;
}

export function progressDocument(view: ProgressView, title: string): string {
	const measuredMax = Math.max(
		0,
		...view.trend.map(
			(point) =>
				(point.measuredInputTokens ?? 0) + (point.measuredOutputTokens ?? 0)
		)
	);
	const body =
		view.days.length === 0
			? "<p>No trainer tasks yet. Finish an exercise to see prompts, tokens, and coaching here.</p>"
			: `<section class="card">
<h2>Measured trainer tokens over time</h2>
<p class="muted">Bars use vendor-reported input plus output. Days with no measured counts show as a gap, not a zero.</p>
<ul>${view.trend
					.map((point) => {
						const tokens =
							point.measuredInputTokens == null
								? "tokens not reported"
								: `${point.measuredInputTokens} in / ${point.measuredOutputTokens} out`;
						const bar =
							point.measuredInputTokens == null
								? ""
								: `<div class="bar"><span style="width:${tokenBarWidth(point, measuredMax)}"></span></div>`;
						return `<li><div class="row"><span>${escapeHtml(point.date)}</span><span>${point.taskCount} ${point.taskCount === 1 ? "task" : "tasks"} · ${escapeHtml(tokens)}</span></div>${bar}</li>`;
					})
					.join("")}</ul>
</section>
${view.days
	.map(
		(day) => `<section class="card">
<h2>${escapeHtml(day.date)}</h2>
<ul>${day.tasks.map(taskHtml).join("")}</ul>
</section>`
	)
	.join("")}`;
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
body { margin: 0; background: #f2f0e8; color: #0d0d0f; font-family: ui-sans-serif, system-ui, sans-serif; }
main { max-width: 48rem; margin: 0 auto; padding: 2rem 1rem; display: grid; gap: 1rem; }
h1 { font-size: 1.5rem; margin: 0; }
h2, h3 { margin: 0 0 0.5rem; font-size: 1rem; }
.muted { color: #5c5c68; font-size: 0.875rem; }
.card { background: #fff; border: 1px solid #d9d6cc; border-radius: 0.75rem; padding: 1.25rem 1.5rem; display: grid; gap: 0.75rem; }
.row { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.875rem; }
.bar { height: 0.5rem; margin-top: 0.35rem; background: #e7e5dc; border-radius: 9999px; }
.bar span { display: block; height: 0.5rem; background: #3f5a00; border-radius: 9999px; }
.task { display: grid; gap: 0.5rem; border-top: 1px solid #d9d6cc; padding-top: 0.75rem; }
.task:first-child { border-top: 0; padding-top: 0; }
.prompt { white-space: pre-wrap; font-family: ui-monospace, monospace; background: #e7e5dc; border-radius: 0.375rem; padding: 0.5rem 0.75rem; }
ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.5rem; }
a { color: inherit; }
.title { font-weight: 600; }
</style>
</head>
<body>
<main>
<h1>Progress</h1>
<p class="muted">Days are bucketed in ${escapeHtml(view.timezone)}. Token totals include only vendor-reported trainer usage. Missing counts are labeled, not guessed. This page is not a skill score.</p>
${body}
</main>
</body>
</html>`;
}
