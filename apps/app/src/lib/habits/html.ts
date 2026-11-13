import type { HabitsView, LeaderboardView } from "./types";

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function themeVars(theme: "light" | "dark") {
	if (theme === "dark") {
		return {
			background: "#0d0d0f",
			border: "#2a2a31",
			card: "#17171a",
			color: "#f4f4f5",
			fill: "#c6ff3d",
			fillText: "#0d0d0f",
			muted: "#a1a1aa",
		};
	}
	return {
		background: "#f2f0e8",
		border: "#d9d6cc",
		card: "#fff",
		color: "#0d0d0f",
		fill: "#3f5a00",
		fillText: "#ffffff",
		muted: "#5c5c68",
	};
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
.banner { background: ${vars.card}; border: 1px dashed ${vars.border}; border-radius: 0.75rem; padding: 0.75rem 1rem; font-size: 0.875rem; }
.card { background: ${vars.card}; border: 1px solid ${vars.border}; border-radius: 0.75rem; padding: 1.25rem 1.5rem; display: grid; gap: 0.75rem; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.stat { font-size: 1.5rem; font-weight: 600; margin: 0; }
.badge { border: 1px solid ${vars.border}; border-radius: 9999px; padding: 0.1rem 0.55rem; font-size: 0.75rem; }
.heat { display: grid; grid-template-columns: repeat(14, 1fr); gap: 0.35rem; }
.heat span { aspect-ratio: 1; border-radius: 0.25rem; border: 1px solid ${vars.border}; background: ${vars.background}; }
.heat span.on { background: ${vars.fill}; border-color: ${vars.fill}; }
.grid { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); }
table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid ${vars.border}; }
a { color: inherit; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function habitsDocument(
	view: HabitsView,
	title: string,
	theme: "light" | "dark" = "light"
): string {
	const heat = view.calendar
		.map((day) => {
			const label = day.qualified
				? `${day.date}, completed captured-task report opened`
				: `${day.date}, no qualifying report`;
			return `<span class="${day.qualified ? "on" : ""}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"></span>`;
		})
		.join("");
	const badges = view.badges
		.map((badge) => {
			const state = badge.earned ? "Earned" : "Locked";
			const heuristic = badge.heuristic ? " Heuristic." : "";
			const link = badge.href
				? `<p><a href="${escapeHtml(badge.href)}">Open earning task</a></p>`
				: "";
			return `<article class="card"><div class="row"><h3>${escapeHtml(badge.title)}</h3><span class="badge">${state}</span></div><p class="muted">${escapeHtml(badge.description)}${heuristic}</p>${link}</article>`;
		})
		.join("");
	const quests = view.quests
		.map(
			(quest) =>
				`<article class="card"><div class="row"><h3>${escapeHtml(quest.title)}</h3><span class="badge">${quest.complete ? "Done" : "This week"}</span></div><p class="muted">${escapeHtml(quest.detail)}${quest.heuristic ? " Heuristic." : ""}</p></article>`
		)
		.join("");
	const bests = view.personalBests
		.map(
			(best) =>
				`<article class="card"><h3>${escapeHtml(best.label)}</h3><p class="stat">${escapeHtml(best.value)}</p></article>`
		)
		.join("");
	const body = `<main>
<p class="banner" role="note">Example data — seeded local fixture, not a live account.</p>
<p class="muted">// Mati</p>
<h1>Progress · Habits</h1>
<p class="muted">Streak days use ${escapeHtml(view.timezone)}. A day counts when you open the report for a completed captured task. No streak freeze: missed days break the run. Weekly points reset Monday 00:00 UTC. Daily cap ${view.dailyCap} points from badges, quests, and streak days — never tokens, prompt count, time, or cost.</p>
<section class="grid">
<article class="card"><h2>Current streak</h2><p class="stat">${view.currentStreak} ${view.currentStreak === 1 ? "day" : "days"}</p></article>
<article class="card"><h2>Best streak</h2><p class="stat">${view.bestStreak} ${view.bestStreak === 1 ? "day" : "days"}</p></article>
<article class="card"><h2>This week</h2><p class="stat">${view.weekPoints} pts</p><p class="muted">Week of ${escapeHtml(view.weekStartsAt)} UTC</p></article>
</section>
<section class="card">
<h2>Last 28 days</h2>
<div class="heat" role="img" aria-label="Streak calendar of the last 28 days">${heat}</div>
</section>
<section><h2>Skill badges</h2><div class="grid">${badges}</div></section>
<section><h2>Personal bests</h2><div class="grid">${bests}</div></section>
<section><h2>Weekly quests</h2><div class="grid">${quests}</div></section>
</main>`;
	return shell(title, theme, body);
}

export function leaderboardDocument(
	view: LeaderboardView,
	title: string,
	theme: "light" | "dark" = "light"
): string {
	const rows = view.rows
		.map(
			(row) =>
				`<tr><td>${row.rank}</td><td>${escapeHtml(row.displayName)}${row.isSelf ? " (you)" : ""}</td><td>${row.points}</td><td>${escapeHtml(row.badgeIds.join(", ") || "—")}</td></tr>`
		)
		.join("");
	const self = view.self
		? `<p>Your rank: ${view.self.rank} · ${view.self.points} points as ${escapeHtml(view.self.displayName)}.</p>`
		: "<p>Opt in from Settings to appear on the board.</p>";
	const body = `<main>
<p class="banner" role="note">Example data — seeded local fixture, not a live account.</p>
<p class="muted">// Mati</p>
<h1>Leaderboard</h1>
<p class="muted">Weekly habit points from badges, quests, and streak days. Resets Monday 00:00 UTC (week of ${escapeHtml(view.weekStartsAt)}). Never ranked by tokens, prompt count, time spent, or cost. Names are opted-in display names only.</p>
${self}
<section class="card">
<table>
<thead><tr><th>Rank</th><th>Name</th><th>Points</th><th>Badges</th></tr></thead>
<tbody>${rows}</tbody>
</table>
</section>
</main>`;
	return shell(title, theme, body);
}
