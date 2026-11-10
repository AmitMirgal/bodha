import { usageCopy } from "./aggregate";
import type { ProgressChartPoint, ProgressTask, ProgressView } from "./types";

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function tokenAmount(value: number | null): string {
	return value == null ? "—" : String(value);
}

function originLabel(origin: ProgressTask["origin"]): string {
	switch (origin) {
		case "copilot":
			return "Copilot";
		case "cursor":
			return "Cursor";
		case "trainer":
			return "Trainer";
		default: {
			const exhaustive: never = origin;
			throw new Error(`Unhandled origin: ${String(exhaustive)}`);
		}
	}
}

function provenanceLabel(label: ProgressTask["usage"]["label"]): string {
	switch (label) {
		case "estimated":
			return "Estimated";
		case "measured":
			return "Measured";
		case "missing":
			return "Not reported";
		default: {
			const exhaustive: never = label;
			throw new Error(`Unhandled token label: ${String(exhaustive)}`);
		}
	}
}

function tokenSourceCopy(task: ProgressTask): string {
	switch (task.usage.label) {
		case "estimated":
			return "text_estimate (labelled estimate from text length, not vendor-measured)";
		case "measured":
			return `vendor-measured (${task.usage.source ?? "provider"})`;
		case "missing":
			return "not reported (omitted, not shown as 0)";
		default: {
			const exhaustive: never = task.usage.label;
			throw new Error(`Unhandled token label: ${String(exhaustive)}`);
		}
	}
}

function tokenCell(task: ProgressTask): string {
	if (task.usage.label === "missing") {
		return "Not reported";
	}
	const input =
		task.usage.inputTokens == null ? "—" : String(task.usage.inputTokens);
	const output =
		task.usage.outputTokens == null ? "—" : String(task.usage.outputTokens);
	if (task.usage.label === "estimated") {
		return `${input} in / ${output} out`;
	}
	const cached =
		task.usage.cachedTokens == null
			? "cached not reported"
			: `${task.usage.cachedTokens} cached`;
	return `${input} in / ${output} out / ${cached}`;
}

function themeVars(theme: "light" | "dark") {
	if (theme === "dark") {
		return {
			background: "#0d0d0f",
			border: "#2a2a31",
			cached: "#d4a017",
			card: "#17171a",
			color: "#f4f4f5",
			input: "#8ec07c",
			muted: "#a1a1aa",
			output: "#83a598",
		};
	}
	return {
		background: "#f2f0e8",
		border: "#d9d6cc",
		cached: "#b08900",
		card: "#fff",
		color: "#0d0d0f",
		input: "#3f5a00",
		muted: "#5c5c68",
		output: "#1d4d4f",
	};
}

function summaryHtml(view: ProgressView): string {
	const measured = view.summary.measured;
	let tokenValue = "Not reported";
	let tokenSplit = "";
	if (measured) {
		tokenValue = `${tokenAmount(measured.inputTokens)} / ${tokenAmount(measured.outputTokens)} / ${tokenAmount(measured.cachedTokens)}`;
		tokenSplit = `<div class="split"><div><p class="muted">Input</p><p class="stat">${escapeHtml(tokenAmount(measured.inputTokens))}</p></div><div><p class="muted">Output</p><p class="stat">${escapeHtml(tokenAmount(measured.outputTokens))}</p></div><div><p class="muted">Cached</p><p class="stat">${escapeHtml(tokenAmount(measured.cachedTokens))}</p></div></div>`;
	} else if (view.summary.estimated) {
		tokenValue = `${tokenAmount(view.summary.estimated.inputTokens)} / ${tokenAmount(view.summary.estimated.outputTokens)}`;
	}
	const tests = view.summary.tests
		? `${view.summary.tests.passed} / ${view.summary.tests.total}`
		: "No harness runs";
	let tokenBadge = "Not reported";
	if (measured) {
		tokenBadge = "Measured";
	} else if (view.summary.estimated) {
		tokenBadge = "Estimated";
	}
	return `<section class="stats" aria-label="Summary">
<div class="card"><div class="row"><h2>Tokens</h2><span class="badge">${escapeHtml(tokenBadge)}</span></div>${tokenSplit || `<p class="stat">${escapeHtml(tokenValue)}</p>`}<p class="muted">Measured input / output / cached. Missing is not shown as 0.</p></div>
<div class="card"><div class="row"><h2>Prompts</h2><span class="badge">Observed</span></div><p class="stat">${view.summary.promptCount}</p></div>
<div class="card"><div class="row"><h2>Tasks completed</h2><span class="badge">Observed</span></div><p class="stat">${view.summary.completedCount} / ${view.summary.taskCount}</p></div>
<div class="card"><div class="row"><h2>Tests</h2><span class="badge">${view.summary.tests ? "Harness" : "Not reported"}</span></div><p class="stat">${escapeHtml(tests)}</p></div>
</section>`;
}

function chartHtml(points: ProgressChartPoint[]): string {
	if (points.length === 0) {
		return "";
	}
	const measured = points.filter(
		(point) =>
			point.measuredCachedTokens != null ||
			point.measuredInputTokens != null ||
			point.measuredOutputTokens != null
	);
	const tokenMax = Math.max(
		1,
		...measured.map(
			(point) =>
				(point.measuredInputTokens ?? 0) +
				(point.measuredOutputTokens ?? 0) +
				(point.measuredCachedTokens ?? 0)
		)
	);
	const promptMax = Math.max(1, ...points.map((point) => point.promptCount));
	const tokenBars =
		measured.length === 0
			? '<p class="muted">No measured token days yet.</p>'
			: `<ul class="bars">${measured
					.map((point) => {
						const input = point.measuredInputTokens ?? 0;
						const output = point.measuredOutputTokens ?? 0;
						const cached = point.measuredCachedTokens ?? 0;
						return `<li><div class="row"><span>${escapeHtml(point.date)}</span><span>${escapeHtml(tokenAmount(point.measuredInputTokens))} in / ${escapeHtml(tokenAmount(point.measuredOutputTokens))} out / ${escapeHtml(tokenAmount(point.measuredCachedTokens))} cached</span></div><div class="stack"><span class="in" style="width:${Math.round((input / tokenMax) * 100)}%"></span><span class="out" style="width:${Math.round((output / tokenMax) * 100)}%"></span><span class="cached" style="width:${Math.round((cached / tokenMax) * 100)}%"></span></div></li>`;
					})
					.join("")}</ul>`;
	const promptBars = `<ul class="bars">${points
		.map(
			(point) =>
				`<li><div class="row"><span>${escapeHtml(point.date)}</span><span>${point.promptCount} prompts</span></div><div class="bar"><span style="width:${Math.round((point.promptCount / promptMax) * 100)}%"></span></div></li>`
		)
		.join("")}</ul>`;
	return `<div class="charts">
<section class="card"><h2>Measured tokens over time</h2><p class="muted">Stacked input, output, and cached from vendor reports. Estimated and missing days are omitted, not drawn as zero.</p>${tokenBars}</section>
<section class="card"><h2>Prompts per day</h2><p class="muted">Stored user prompts on days that had a task. This is a count of prompts, not tokens.</p>${promptBars}</section>
</div>`;
}

function taskCardHtml(task: ProgressTask): string {
	const top = task.suggestions[0];
	let suggestion =
		'<p class="muted">No learning report yet. Finish the session to generate one.</p>';
	if (top) {
		suggestion = `<p><strong>Try next:</strong> ${escapeHtml(top.title)}. ${escapeHtml(top.improvedExample)}</p>`;
	} else if (task.outcome) {
		suggestion =
			'<p class="muted">No prompt improvement stored for this task.</p>';
	} else if (task.source === "editor") {
		suggestion =
			'<p class="muted">No learning report yet. Close the editor task to assemble one from captured prompts.</p>';
	}
	return `<article class="card task">
<div class="row"><h3><a href="${escapeHtml(task.reportHref)}">${escapeHtml(task.exerciseId)}</a></h3><span class="badge">${escapeHtml(originLabel(task.origin))}</span><span class="badge">${escapeHtml(provenanceLabel(task.usage.label))}</span></div>
<p class="muted">${task.prompts.length} ${task.prompts.length === 1 ? "prompt" : "prompts"} · ${escapeHtml(task.status)}</p>
${
	task.prompts[0]
		? `<pre class="prompt">${escapeHtml(task.prompts[0])}</pre>`
		: '<p class="muted">No prompts were stored for this task.</p>'
}
<p>${escapeHtml(usageCopy(task.usage, task.source))}</p>
<p><strong>Outcome:</strong> ${escapeHtml(task.outcome?.observed ?? "No outcome stored yet.")}</p>
${suggestion}
</article>`;
}

function tableHtml(tasks: ProgressTask[]): string {
	return `<section class="card"><h2>All tasks</h2>
<div class="scroll"><table>
<thead><tr><th>Date</th><th>Source</th><th>Prompts</th><th>Tokens</th><th>Outcome</th><th>Report</th></tr></thead>
<tbody>${tasks
		.map(
			(task) =>
				`<tr><td>${escapeHtml(task.occurredAt.slice(0, 10))}</td><td>${escapeHtml(originLabel(task.origin))}</td><td>${task.prompts.length}</td><td>${escapeHtml(tokenCell(task))}</td><td>${escapeHtml(task.outcome?.observed ?? task.status)}</td><td><a href="${escapeHtml(task.reportHref)}">Open</a></td></tr>`
		)
		.join("")}</tbody>
</table></div></section>`;
}

function shell(title: string, theme: "light" | "dark", body: string): string {
	const vars = themeVars(theme);
	return `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
body { margin: 0; background: ${vars.background}; color: ${vars.color}; font-family: ui-sans-serif, system-ui, sans-serif; }
main { max-width: 72rem; margin: 0 auto; padding: 2rem 1rem; display: grid; gap: 1rem; }
h1 { font-size: 1.75rem; margin: 0; letter-spacing: -0.03em; }
h2, h3 { margin: 0; font-size: 1rem; }
.muted { color: ${vars.muted}; font-size: 0.875rem; }
.stats, .charts, .cards { display: grid; gap: 0.75rem; }
.stats { grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); }
.charts { grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); }
.cards { grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); }
.card { background: ${vars.card}; border: 1px solid ${vars.border}; border-radius: 0.75rem; padding: 1.25rem 1.5rem; display: grid; gap: 0.75rem; }
.stat { font-size: 1.5rem; font-weight: 600; margin: 0; }
.split { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; font-size: 0.875rem; }
.badge { border: 1px solid ${vars.border}; border-radius: 9999px; padding: 0.1rem 0.55rem; font-size: 0.75rem; }
.bar, .stack { height: 0.5rem; background: ${vars.border}; border-radius: 9999px; overflow: hidden; display: flex; }
.bar span, .stack .in { display: block; height: 0.5rem; background: ${vars.input}; }
.stack .out { background: ${vars.output}; }
.stack .cached { background: ${vars.cached}; }
.bars { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.65rem; }
.scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid ${vars.border}; }
a { color: inherit; }
.prompt { white-space: pre-wrap; font-family: ui-monospace, monospace; background: ${vars.border}; border-radius: 0.375rem; padding: 0.5rem 0.75rem; }
.skeleton { background: ${vars.border}; border-radius: 0.75rem; min-height: 4.5rem; }
.callout { border-style: dashed; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function progressDocument(
	view: ProgressView,
	title: string,
	theme: "light" | "dark" = "light"
): string {
	const emptyAll =
		view.tasks.length === 0
			? '<p class="card">No tasks yet. Finish a trainer exercise or claim an editor device from Settings.</p>'
			: "";
	const missing =
		view.summary.missingTaskCount > 0
			? `<p class="card callout" role="status">${view.summary.missingTaskCount} ${view.summary.missingTaskCount === 1 ? "task" : "tasks"} had no vendor token count. Those totals are omitted, not shown as 0.</p>`
			: "";
	const tasks =
		view.tasks.length === 0
			? ""
			: `<section aria-label="Tasks"><h2>Tasks</h2><div class="cards">${view.tasks.map(taskCardHtml).join("")}</div></section>${tableHtml(view.tasks)}`;
	const body = `<main>
<h1>Progress</h1>
<p class="muted">How you used AI, and what to try next. Days use ${escapeHtml(view.timezone)}. Measured totals never mix in estimates. Missing counts are labeled, not shown as zero. This page is not a skill score.</p>
<nav class="row" aria-label="Task source"><span class="badge">All (${view.tasks.length})</span><span class="badge">Trainer (${view.tasks.filter((task) => task.origin === "trainer").length})</span><span class="badge">Cursor (${view.tasks.filter((task) => task.origin === "cursor").length})</span><span class="badge">Copilot (${view.tasks.filter((task) => task.origin === "copilot").length})</span></nav>
${summaryHtml(view)}
${missing}
${chartHtml(view.chart)}
${emptyAll}
${tasks}
</main>`;
	return shell(title, theme, body);
}

export function progressTaskDocument(
	task: ProgressTask,
	title: string,
	theme: "light" | "dark" = "light"
): string {
	const prompts =
		task.promptTurns.length === 0
			? '<p class="muted">No prompts were stored for this task.</p>'
			: `<ol class="bars">${task.promptTurns
					.map((turn) => {
						const tokens =
							turn.usage.label === "missing"
								? "Per-prompt vendor tokens were not stored. Task totals are labelled above."
								: tokenCell({ ...task, usage: turn.usage });
						return `<li class="card"><p class="muted">${escapeHtml(turn.occurredAt ?? "time not stored")}</p><pre class="prompt">${escapeHtml(turn.text)}</pre><p class="muted">${escapeHtml(tokens)}</p></li>`;
					})
					.join("")}</ol>`;
	const suggestions =
		task.suggestions.length === 0
			? '<p class="muted">No learning report yet.</p>'
			: task.suggestions
					.map(
						(suggestion) => `<section class="card">
<h2>${escapeHtml(suggestion.title)}</h2>
<p><strong>Improved example:</strong> ${escapeHtml(suggestion.improvedExample)}</p>
<p><strong>Why it helps:</strong> ${escapeHtml(suggestion.whyItHelps)}</p>
<p class="muted">${suggestion.illustrative ? "Illustrative recommendation" : "Recommendation grounded in stored evidence"}</p>
</section>`
					)
					.join("");
	const files =
		task.filePaths.length === 0
			? '<p class="muted">No edited file paths were stored for this task.</p>'
			: `<ul>${task.filePaths.map((path) => `<li>${escapeHtml(path)}</li>`).join("")}</ul>`;
	const responses =
		task.responses.length === 0
			? '<p class="muted">No assistant responses were stored for this task.</p>'
			: task.responses
					.map(
						(response) =>
							`<section class="card"><p class="muted">${escapeHtml(response.occurredAt)}</p><pre class="prompt">${escapeHtml(response.text)}</pre></section>`
					)
					.join("");
	const tokenSource = tokenSourceCopy(task);
	const coaching = task.coachingSummary
		? `<p>${escapeHtml(task.coachingSummary)}</p>`
		: '<p class="muted">No coaching stored yet.</p>';
	const body = `<main>
<p class="muted"><a href="/progress">Progress</a> · ${escapeHtml(originLabel(task.origin))}</p>
<h1>${escapeHtml(task.exerciseId)}</h1>
<p>${escapeHtml(usageCopy(task.usage, task.source))}</p>
<p class="muted">Token source · ${escapeHtml(tokenSource)}</p>
<p><strong>Observed:</strong> ${escapeHtml(task.outcome?.observed ?? "No outcome stored yet.")}</p>
<section class="card"><h2>Prompt timeline</h2>${prompts}</section>
<section class="card"><h2>Responses</h2>${responses}</section>
<section class="card"><h2>Edited files</h2>${files}</section>
<section class="card"><h2>Coaching</h2><p class="muted">Suggestions are recommendations, not skill scores.</p>${coaching}</section>
${suggestions}
</main>`;
	return shell(title, theme, body);
}

export function progressLoadingDocument(
	theme: "light" | "dark" = "light"
): string {
	const body = `<main aria-busy="true" aria-label="Loading progress">
<div class="skeleton" style="height:2.25rem;width:10rem"></div>
<div class="skeleton" style="height:1rem;max-width:36rem"></div>
<div class="stats"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>
<div class="charts"><div class="skeleton" style="min-height:14rem"></div><div class="skeleton" style="min-height:14rem"></div></div>
<div class="skeleton" style="min-height:12rem"></div>
</main>`;
	return shell("Progress loading", theme, body);
}
