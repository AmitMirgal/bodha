import { badgeCatalogEntry, isBadgeId } from "./catalog";
import {
	contributionGrid,
	dayActivityLabel,
	WEEKDAY_LABELS,
} from "./contribution";
import {
	GAMIFICATION_MIGRATE_COMMAND,
	GAMIFICATION_MIGRATION_MESSAGE,
} from "./copy";
import type {
	ActivityLevel,
	BadgeId,
	CalendarDay,
	HabitsView,
	LeaderboardRow,
	LeaderboardView,
} from "./types";
import { STREAK_CALENDAR_WEEKS } from "./types";

function migrationNotice(required: boolean): string {
	if (!required) {
		return "";
	}
	return `<section class="notice"><h2>Database migration required</h2><p class="muted">${escapeHtml(GAMIFICATION_MIGRATION_MESSAGE)} An operator must run <code>${escapeHtml(GAMIFICATION_MIGRATE_COMMAND)}</code>. Do not prisma db push.</p></section>`;
}

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
			lvl0: "#2a2a31",
			lvl1: "#4a5a24",
			lvl2: "#7a962e",
			lvl3: "#a8c936",
			lvl4: "#c6ff3d",
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
		lvl0: "#e7e5dc",
		lvl1: "#c5d39a",
		lvl2: "#8fa45a",
		lvl3: "#627a26",
		lvl4: "#3f5a00",
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
main { max-width: 72rem; margin: 0 auto; padding: 2.5rem 1rem; display: grid; gap: 1.25rem; }
h1 { font-size: 2.25rem; margin: 0; letter-spacing: -0.03em; }
h2, h3 { margin: 0; }
h2 { font-size: 1.125rem; }
h3 { font-size: 0.875rem; font-weight: 600; }
.eyebrow { color: ${vars.muted}; font-size: 0.875rem; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; }
.muted { color: ${vars.muted}; font-size: 0.875rem; }
.lede { color: ${vars.muted}; font-size: 0.875rem; max-width: 48rem; }
.banner { background: ${vars.secondary}; border-bottom: 1px solid ${vars.border}; padding: 0.5rem 1rem; text-align: center; font-size: 0.875rem; color: ${vars.muted}; }
.card { background: ${vars.card}; border: 1px solid ${vars.border}; border-radius: 0.75rem; padding: 1rem 1.25rem; display: grid; gap: 0.5rem; }
.you { background: color-mix(in srgb, ${vars.secondary} 70%, ${vars.card}); }
.stack { display: grid; gap: 0.5rem; }
.heading { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem 0.75rem; }
.badge { border: 1px solid ${vars.border}; border-radius: 9999px; padding: 0.1rem 0.55rem; font-size: 0.75rem; }
.badge-card:not(.locked) .badge, .quests .badge.done { background: ${vars.accent}; color: ${vars.accentFg}; border-color: ${vars.accent}; }
.chip { display: inline-flex; align-items: center; gap: 0.25rem; border: 1px solid ${vars.border}; background: ${vars.secondary}; border-radius: 9999px; padding: 0.15rem 0.5rem; font-size: 0.75rem; }
.chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0; padding: 0; list-style: none; }
.inline { color: ${vars.muted}; font-size: 0.875rem; }
.inline b { color: ${vars.color}; font-weight: 600; font-variant-numeric: tabular-nums; }
.contrib { overflow-x: auto; width: 100%; }
.contrib-inner { min-width: calc(${STREAK_CALENDAR_WEEKS} * 14px + 2.5rem); width: 100%; }
.contrib table { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 3px; }
.contrib th, .contrib td { padding: 0; }
.contrib .month { font-size: 10px; color: ${vars.muted}; font-weight: 400; text-align: left; height: 14px; overflow: hidden; }
.contrib .wd { font-size: 10px; color: ${vars.muted}; font-weight: 400; text-align: right; padding-right: 4px; width: 1.75rem; }
.cell { display: block; width: 100%; min-width: 11px; aspect-ratio: 1 / 1; height: auto; border-radius: 2px; }
.legend .cell { width: 11px; min-width: 11px; height: 11px; flex: 0 0 11px; aspect-ratio: auto; }
.lvl-0 { background: ${vars.lvl0}; }
.lvl-1 { background: ${vars.lvl1}; }
.lvl-2 { background: ${vars.lvl2}; }
.lvl-3 { background: ${vars.lvl3}; }
.lvl-4 { background: ${vars.lvl4}; }
.legend { display: flex; align-items: center; justify-content: flex-end; gap: 4px; font-size: 10px; color: ${vars.muted}; }
.notice { border: 1px solid ${vars.border}; border-radius: 0.75rem; padding: 0.85rem 1rem; display: grid; gap: 0.35rem; }
.notice code { font-size: 0.75rem; }
.badge-grid { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.5rem; grid-template-columns: repeat(auto-fill, minmax(13.5rem, 1fr)); }
.badge-card { display: flex; align-items: center; gap: 0.4rem; border: 1px solid ${vars.border}; background: ${vars.card}; border-radius: 0.5rem; padding: 0.4rem 0.55rem; font-size: 0.8125rem; }
.badge-card.locked { background: transparent; border-style: dashed; color: ${vars.muted}; }
.badge-card a { font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }
.badge-card .name { font-weight: 600; min-width: 0; flex: 1; line-height: 1.25; }
.bests, .quests { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.5rem; font-size: 0.875rem; }
.bests { gap: 0.35rem; }
.bests li { display: flex; justify-content: space-between; gap: 0.75rem; align-items: baseline; }
.quests li { display: grid; gap: 0.1rem; }
.quests .heading { gap: 0.5rem; }
.columns { display: grid; gap: 1.25rem; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); align-items: start; }
table.board { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
table.board th, table.board td { text-align: left; padding: 0.7rem 0.75rem; border-bottom: 1px solid ${vars.border}; }
.rank { display: inline-flex; align-items: center; gap: 0.35rem; font-variant-numeric: tabular-nums; }
a { color: inherit; }
.empty { border-style: dashed; text-align: center; padding: 3rem 1.5rem; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
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

function medalSvg(): string {
	return '<svg aria-hidden="true" fill="none" height="12" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="12"><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/></svg>';
}

function rankCell(rank: number): string {
	switch (rank) {
		case 1:
			return `<span class="rank" aria-label="Rank 1, gold">${medalSvg()} 1</span>`;
		case 2:
			return `<span class="rank" aria-label="Rank 2, silver">${medalSvg()} 2</span>`;
		case 3:
			return `<span class="rank" aria-label="Rank 3, bronze">${medalSvg()} 3</span>`;
		default:
			return `<span class="rank">${rank}</span>`;
	}
}

function levelClass(level: ActivityLevel): string {
	switch (level) {
		case 0:
			return "lvl-0";
		case 1:
			return "lvl-1";
		case 2:
			return "lvl-2";
		case 3:
			return "lvl-3";
		case 4:
			return "lvl-4";
		default: {
			const exhaustive: never = level;
			throw new Error(`Unhandled level: ${String(exhaustive)}`);
		}
	}
}

function contributionTable(calendar: CalendarDay[]): string {
	const { months, weeks } = contributionGrid(calendar);
	const monthRow = months
		.map(
			(month) =>
				`<th class="month" colspan="${month.colSpan}" scope="colgroup">${escapeHtml(month.label)}</th>`
		)
		.join("");
	const body = WEEKDAY_LABELS.map((weekday, row) => {
		const label = row % 2 === 0 ? weekday : "";
		const cells = weeks
			.map((week) => {
				const day = week[row];
				if (!day) {
					return "<td></td>";
				}
				if (!day.inRange) {
					return '<td><span class="cell" aria-hidden="true"></span></td>';
				}
				const labelText = dayActivityLabel(day) ?? day.date;
				return `<td><span class="cell ${levelClass(day.level)}" aria-label="${escapeHtml(labelText)}" title="${escapeHtml(labelText)}"></span></td>`;
			})
			.join("");
		return `<tr><th class="wd" scope="row">${label}</th>${cells}</tr>`;
	}).join("");
	return `<div class="contrib"><div class="contrib-inner"><table>
<caption class="sr-only">Contribution graph of qualifying report opens over the last ${STREAK_CALENDAR_WEEKS} weeks</caption>
<thead><tr><td></td>${monthRow}</tr></thead>
<tbody>${body}</tbody>
</table>
<p class="legend"><span>Less</span><span class="cell lvl-0" aria-hidden="true"></span><span class="cell lvl-1" aria-hidden="true"></span><span class="cell lvl-2" aria-hidden="true"></span><span class="cell lvl-3" aria-hidden="true"></span><span class="cell lvl-4" aria-hidden="true"></span><span>More</span></p>
</div></div>`;
}

function boardTable(rows: LeaderboardRow[], caption: string): string {
	const body = rows
		.map(
			(row) =>
				`<tr class="${row.isSelf ? "you" : ""}"><td>${rankCell(row.rank)}</td><td>${escapeHtml(row.displayName)}${row.isSelf ? ' <span class="badge">You</span>' : ""}</td><td>${row.points}</td><td>${badgeChips(row.badgeIds)}</td></tr>`
		)
		.join("");
	return `<div class="card" style="padding:0"><table class="board">
<caption class="sr-only">${escapeHtml(caption)}</caption>
<thead><tr><th>Rank</th><th>Name</th><th>Points</th><th>Badges</th></tr></thead>
<tbody>${body}</tbody>
</table></div>`;
}

export function habitsDocument(
	view: HabitsView,
	title: string,
	theme: "light" | "dark" = "light"
): string {
	const currentWord = view.currentStreak === 1 ? "day" : "days";
	const badges = view.badges
		.map((badge) => {
			const state = badge.earned ? "Earned" : "Locked";
			const hint = `${badge.description}${badge.heuristic ? " Heuristic." : ""}`;
			const name = badge.href
				? `<a href="${escapeHtml(badge.href)}">${escapeHtml(badge.title)}</a>`
				: escapeHtml(badge.title);
			const locked = badge.earned ? "" : " locked";
			return `<li><div class="badge-card${locked}" title="${escapeHtml(hint)}"><span class="muted">${badgeIconSvg(badge.id)}</span><span class="name">${name}</span><span class="badge">${state}</span></div></li>`;
		})
		.join("");
	const quests = view.quests
		.map(
			(quest) =>
				`<li><div class="heading"><span>${escapeHtml(quest.title)}</span><span class="badge${quest.complete ? " done" : ""}">${quest.complete ? "Done" : "This week"}</span></div><p class="muted">${escapeHtml(quest.detail)}${quest.heuristic ? " Heuristic." : ""}</p></li>`
		)
		.join("");
	const bests = view.personalBests
		.map(
			(best) =>
				`<li><span class="muted">${escapeHtml(best.label)}</span><span>${escapeHtml(best.value)}</span></li>`
		)
		.join("");
	const body = `<main>
<header class="stack">
<p class="eyebrow">How you used AI</p>
<div class="heading"><h1>Progress</h1>${view.exampleData ? '<span class="badge">Example data</span>' : ""}</div>
</header>
<section class="stack" aria-labelledby="habits-heading">
<div class="heading">
<h2 id="habits-heading">Habits</h2>
<p class="inline"><b>${view.currentStreak}</b> current ${currentWord} · <b>${view.bestStreak}</b> best · <b>${view.weekPoints}</b> pts this week</p>
</div>
<p class="lede">A day counts when you open the report for a completed captured editor task (${escapeHtml(view.timezone)}). Missed days break the run. Weekly points reset Monday 00:00 UTC.</p>
${migrationNotice(view.migrationRequired)}
${contributionTable(view.calendar)}
<div class="columns">
<section class="stack"><h3>Skill badges</h3><ul class="badge-grid">${badges}</ul></section>
<div class="stack">
<section class="stack"><h3>Personal bests</h3><ul class="bests">${bests}</ul></section>
<section class="stack"><h3>Weekly quests</h3><ul class="quests">${quests}</ul></section>
</div>
</div>
</section>
</main>`;
	return shell(title, theme, "progress", body);
}

export function leaderboardDocument(
	view: LeaderboardView,
	title: string,
	theme: "light" | "dark" = "light"
): string {
	const rows = view.rows.filter((row) => row.rank <= view.topN);
	const pinned = view.self && view.self.rank > view.topN ? view.self : null;
	const optIn = view.optedIn
		? ""
		: `<section class="card" style="border-style:dashed"><h2>Join this week's board</h2><p class="muted">The leaderboard is off by default. Choose a public display name in Settings.</p><p><a href="/settings">Opt in from Settings</a></p></section>`;
	const empty = `<section class="card empty"><h2>Nobody has opted in this week</h2><p class="muted">The board stays empty until someone opts in from Settings. Names and habit points are the only public fields.</p></section>`;
	const pinnedBlock = pinned
		? `<p class="muted">Your rank this week</p>${boardTable([pinned], "Signed-in user rank outside the listed rows")}`
		: "";
	const board =
		rows.length === 0 && pinned == null
			? empty
			: `${boardTable(rows, `Weekly habit leaderboard for week of ${view.weekStartsAt} UTC`)}${pinnedBlock}`;
	const body = `<main>
<header class="stack">
<p class="eyebrow">Weekly habits</p>
<div class="heading"><h1>Leaderboard</h1>${view.exampleData ? '<span class="badge">Example data</span>' : ""}</div>
<p class="lede">Weekly habit points from badges, quests, and streak days. Resets Monday 00:00 UTC. Only opted-in display names and points are public.</p>
</header>
${migrationNotice(view.migrationRequired)}
${optIn}
${board}
</main>`;
	return shell(title, theme, "leaderboard", body);
}
