import { badgeCatalogEntry, isBadgeId } from "./catalog";
import type {
	BadgeId,
	HabitsView,
	LeaderboardRow,
	LeaderboardView,
} from "./types";

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
			accent: "#c6ff3d",
			accentFg: "#0d0d0f",
			avatar: "#c6ff3d",
			avatarFg: "#0d0d0f",
			background: "#0d0d0f",
			border: "#2a2a31",
			card: "#17171a",
			color: "#f4f4f5",
			fill: "#c6ff3d",
			muted: "#a1a1aa",
			nav: "#0d0d0f",
			secondary: "#1d1d24",
		};
	}
	return {
		accent: "#3f5a00",
		accentFg: "#ffffff",
		avatar: "#3f5a00",
		avatarFg: "#ffffff",
		background: "#f2f0e8",
		border: "#d9d6cc",
		card: "#fff",
		color: "#0d0d0f",
		fill: "#3f5a00",
		muted: "#5c5c68",
		nav: "#f2f0e8",
		secondary: "#e7e5dc",
	};
}

function appNav(active: "progress" | "leaderboard"): string {
	const link = (href: string, label: string, isActive: boolean) =>
		`<a ${isActive ? 'aria-current="page" class="active"' : ""} href="${href}">${label}</a>`;
	return `<header class="app-nav">
<div class="app-nav-inner">
<a class="logo" href="/"><span aria-hidden="true">//</span> Mati</a>
<nav aria-label="App">
${link("/exercises", "Exercises", false)}
${link("/progress", "Progress", active === "progress")}
${link("/leaderboard", "Leaderboard", active === "leaderboard")}
</nav>
<button aria-label="Account menu" class="avatar" type="button">LE</button>
</div>
</header>`;
}

function shell(
	title: string,
	theme: "light" | "dark",
	active: "progress" | "leaderboard",
	body: string
): string {
	const vars = themeVars(theme);
	return `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
body { margin: 0; background: ${vars.background}; color: ${vars.color}; font-family: ui-sans-serif, system-ui, sans-serif; }
.app-nav { position: sticky; top: 0; border-bottom: 1px solid ${vars.border}; background: color-mix(in srgb, ${vars.nav} 95%, transparent); }
.app-nav-inner { max-width: 72rem; margin: 0 auto; padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
.app-nav nav { display: flex; gap: 0.25rem; }
.app-nav nav a { border-radius: 0.5rem; padding: 0.5rem 0.75rem; text-decoration: none; color: inherit; }
.app-nav nav a.active { background: ${vars.secondary}; font-weight: 600; }
.logo { font-weight: 600; text-decoration: none; color: inherit; }
.avatar { width: 2.25rem; height: 2.25rem; border-radius: 9999px; border: 0; background: ${vars.avatar}; color: ${vars.avatarFg}; font-size: 0.75rem; font-weight: 600; }
main { max-width: 72rem; margin: 0 auto; padding: 2.5rem 1rem; display: grid; gap: 1.5rem; }
h1 { font-size: 2.25rem; margin: 0; letter-spacing: -0.03em; }
h2, h3 { margin: 0; }
h2 { font-size: 1.125rem; }
h3 { font-size: 1rem; }
.eyebrow { color: ${vars.muted}; font-size: 0.875rem; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; }
.muted { color: ${vars.muted}; font-size: 0.875rem; }
.lede { color: ${vars.muted}; font-size: 0.875rem; max-width: 48rem; }
.banner { background: ${vars.secondary}; border-bottom: 1px solid ${vars.border}; padding: 0.5rem 1rem; text-align: center; font-size: 0.875rem; color: ${vars.muted}; }
.card { background: ${vars.card}; border: 1px solid ${vars.border}; border-radius: 0.75rem; padding: 1.25rem 1.5rem; display: grid; gap: 0.75rem; box-shadow: 0 1px 2px rgb(0 0 0 / 0.04); }
.you { outline: 2px solid ${vars.accent}; outline-offset: 0; }
.stat { font-size: 1.75rem; font-weight: 600; margin: 0; font-variant-numeric: tabular-nums; }
.stack { display: grid; gap: 0.75rem; }
.kpis, .podium, .card-grid { display: grid; gap: 0.75rem; }
.kpis { grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); }
.podium { grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); }
.card-grid { grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); }
.row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.heading { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.badge { border: 1px solid ${vars.border}; border-radius: 9999px; padding: 0.1rem 0.55rem; font-size: 0.75rem; }
.chip { display: inline-flex; align-items: center; gap: 0.25rem; border: 1px solid ${vars.border}; background: ${vars.secondary}; border-radius: 9999px; padding: 0.15rem 0.5rem; font-size: 0.75rem; }
.chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.icon { width: 2.25rem; height: 2.25rem; border-radius: 0.5rem; display: inline-flex; align-items: center; justify-content: center; background: color-mix(in srgb, ${vars.accent} 16%, transparent); color: ${vars.accent}; font-weight: 700; }
.rank { width: 2.5rem; height: 2.5rem; border-radius: 0.5rem; display: inline-flex; align-items: center; justify-content: center; font-weight: 600; background: ${vars.secondary}; }
.rank.one { background: ${vars.accent}; color: ${vars.accentFg}; }
.heat { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.35rem; max-width: 20rem; }
.heat span { aspect-ratio: 1; border-radius: 0.25rem; border: 1px solid ${vars.border}; background: ${vars.secondary}; }
.heat span.on { background: ${vars.fill}; border-color: ${vars.fill}; }
table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid ${vars.border}; }
a { color: inherit; }
.empty { border-style: dashed; text-align: center; padding: 3rem 1.5rem; }
</style>
</head>
<body>
<p class="banner" role="note">Example data — seeded local fixture, not a live account.</p>
${appNav(active)}
${body}
</body>
</html>`;
}

function badgeIconSvg(id: BadgeId): string {
	const svg = (inner: string) =>
		`<svg aria-hidden="true" fill="none" height="12" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="12">${inner}</svg>`;
	switch (id) {
		case "first_close":
			return svg(
				'<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>'
			);
		case "first_report":
			return svg(
				'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'
			);
		case "clear_spec":
			return svg(
				'<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>'
			);
		case "one_shot":
			return svg(
				'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'
			);
		case "report_3":
			return svg(
				'<path d="M3 5h8"/><path d="M3 12h15"/><path d="M3 19h12"/><path d="m16 5 3 3 5-5"/>'
			);
		case "streak_7":
			return svg(
				'<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'
			);
		default: {
			const exhaustive: never = id;
			throw new Error(`Unhandled badge: ${String(exhaustive)}`);
		}
	}
}

function badgeChips(ids: string[]): string {
	const known = ids.filter(isBadgeId);
	if (known.length === 0) {
		return '<span class="muted">—</span>';
	}
	return `<ul class="chips">${known
		.map((id) => {
			const entry = badgeCatalogEntry(id);
			const label = entry.heuristic
				? `${entry.title} (heuristic)`
				: entry.title;
			return `<li><span class="chip" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${badgeIconSvg(id)} ${escapeHtml(entry.title)}</span></li>`;
		})
		.join("")}</ul>`;
}

function podiumPlace(rank: number): string {
	switch (rank) {
		case 1:
			return "1st";
		case 2:
			return "2nd";
		case 3:
			return "3rd";
		default:
			return `#${rank}`;
	}
}

function podiumCard(row: LeaderboardRow): string {
	const you = row.isSelf ? " you" : "";
	const first = row.rank === 1 ? " one" : "";
	const youBadge = row.isSelf ? " · You" : "";
	return `<article class="card${you}">
<div class="row"><span class="rank${first}">${row.rank}</span><span class="badge">${podiumPlace(row.rank)}${youBadge}</span></div>
<h3>${escapeHtml(row.displayName)}</h3>
<p class="stat">${row.points} <span class="muted">pts</span></p>
${badgeChips(row.badgeIds)}
</article>`;
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
<header class="stack">
<p class="eyebrow">How you used AI</p>
<div class="heading"><h1>Progress</h1>${view.exampleData ? '<span class="badge">Example data</span>' : ""}</div>
<p class="lede">Streak days use ${escapeHtml(view.timezone)}. A day counts when you open the report for a completed captured task. No streak freeze: missed days break the run. Weekly points reset Monday 00:00 UTC. Daily cap ${view.dailyCap} points from badges, quests, and streak days — never tokens, prompt count, time, or cost.</p>
</header>
<section class="kpis" aria-label="Habits summary">
<article class="card"><div class="row"><span class="icon" aria-hidden>S</span><span class="badge">Observed</span></div><h2>Current streak</h2><p class="stat">${view.currentStreak} <span class="muted">${view.currentStreak === 1 ? "day" : "days"}</span></p></article>
<article class="card"><div class="row"><span class="icon" aria-hidden>B</span><span class="badge">Observed</span></div><h2>Best streak</h2><p class="stat">${view.bestStreak} <span class="muted">${view.bestStreak === 1 ? "day" : "days"}</span></p></article>
<article class="card"><div class="row"><span class="icon" aria-hidden>W</span><span class="badge">UTC</span></div><h2>This week</h2><p class="stat">${view.weekPoints} <span class="muted">pts</span></p><p class="muted">Week of ${escapeHtml(view.weekStartsAt)} UTC</p></article>
</section>
<section class="card">
<h2>Last 28 days</h2>
<div class="heat" role="img" aria-label="Streak calendar of the last 28 days">${heat}</div>
</section>
<section class="stack"><h2>Skill badges</h2><div class="card-grid">${badges}</div></section>
<section class="stack"><h2>Personal bests</h2><div class="card-grid">${bests}</div></section>
<section class="stack"><h2>Weekly quests</h2><div class="card-grid">${quests}</div></section>
</main>`;
	return shell(title, theme, "progress", body);
}

export function leaderboardDocument(
	view: LeaderboardView,
	title: string,
	theme: "light" | "dark" = "light"
): string {
	const podium = view.rows.filter((row) => row.rank <= 3).slice(0, 3);
	const rest = view.rows.filter((row) => row.rank > 3);
	const rankValue = view.self ? `#${view.self.rank}` : "—";
	const pointsValue = view.self ? String(view.self.points) : "—";
	const optIn = view.optedIn
		? ""
		: `<section class="card" style="border-style:dashed"><h2>Join this week's board</h2><p class="muted">The leaderboard is off by default. Choose a public display name in Settings.</p><p><a href="/settings">Opt in from Settings</a></p></section>`;
	const empty = `<section class="card empty"><h2>Nobody has opted in this week</h2><p class="muted">The board stays empty until someone opts in from Settings. Names and habit points are the only public fields.</p></section>`;
	const restTable =
		rest.length === 0
			? ""
			: `<section class="card"><h2>This week</h2>
<table>
<thead><tr><th>Rank</th><th>Name</th><th>Points</th><th>Badges</th></tr></thead>
<tbody>${rest
					.map(
						(row) =>
							`<tr class="${row.isSelf ? "you" : ""}"><td>${row.rank}</td><td>${escapeHtml(row.displayName)}${row.isSelf ? ' <span class="badge">You</span>' : ""}</td><td>${row.points}</td><td>${badgeChips(row.badgeIds)}</td></tr>`
					)
					.join("")}</tbody>
</table></section>`;
	const board =
		view.rows.length === 0
			? empty
			: `<section class="stack"><h2>Top 3</h2><div class="podium">${podium.map(podiumCard).join("")}</div></section>${restTable}`;
	const body = `<main>
<header class="stack">
<p class="eyebrow">Weekly habits</p>
<div class="heading"><h1>Leaderboard</h1>${view.exampleData ? '<span class="badge">Example data</span>' : ""}</div>
<p class="lede">Weekly habit points from badges, quests, and streak days. Resets Monday 00:00 UTC (week of ${escapeHtml(view.weekStartsAt)}). Never ranked by tokens, prompt count, time spent, or cost. Only opted-in display names and points are public.</p>
</header>
<section class="kpis" aria-label="Your standing">
<article class="card"><div class="row"><span class="icon" aria-hidden>#</span><span class="badge">${view.self ? "You" : "Off"}</span></div><h2>Your rank</h2><p class="stat">${rankValue}</p></article>
<article class="card"><div class="row"><span class="icon" aria-hidden>P</span><span class="badge">This week</span></div><h2>Your points</h2><p class="stat">${pointsValue}</p></article>
<article class="card"><div class="row"><span class="icon" aria-hidden>W</span><span class="badge">UTC</span></div><h2>Week of</h2><p class="stat">${escapeHtml(view.weekStartsAt)}</p><p class="muted">${view.rows.length} opted-in names this week.</p></article>
</section>
${optIn}
${board}
</main>`;
	return shell(title, theme, "leaderboard", body);
}
