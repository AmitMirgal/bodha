import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GAMIFICATION_MIGRATE_COMMAND } from "./copy";
import {
	emptyHabitsView,
	emptyLeaderboardView,
	outsideLeaderboardView,
	seededHabitsView,
	seededLeaderboardView,
} from "./fixture";
import { habitsDocument, leaderboardDocument } from "./html";
import { unavailableLeaderboardView } from "./schema";
import { STREAK_CALENDAR_WEEKS } from "./types";

const ARTIFACTS = "/opt/cursor/artifacts";

function writeDoc(name: string, html: string): string {
	mkdirSync(ARTIFACTS, { recursive: true });
	const htmlPath = `${ARTIFACTS}/${name}.html`;
	writeFileSync(htmlPath, html);
	return htmlPath;
}

function screenshot(name: string, htmlPath: string): string | null {
	const pngPath = `${ARTIFACTS}/${name}.png`;
	const userData = `/tmp/chrome-habits-${name}`;
	try {
		execFileSync(
			"timeout",
			[
				"--kill-after=1",
				"5",
				"google-chrome",
				"--headless=old",
				`--user-data-dir=${userData}`,
				"--disable-gpu",
				"--remote-debugging-port=0",
				"--window-size=1280,1100",
				`--screenshot=${pngPath}`,
				`file://${htmlPath}`,
			],
			{ timeout: 8000, stdio: "pipe" }
		);
		return pngPath;
	} catch {
		return null;
	}
}

describe("habits documents", () => {
	it("writes seeded Progress habits and leaderboard HTML labeled as example data", () => {
		const habits = habitsDocument(seededHabitsView(), "Progress habits");
		const habitsDark = habitsDocument(
			seededHabitsView(),
			"Progress habits dark",
			"dark"
		);
		const empty = habitsDocument(emptyHabitsView(), "Progress habits empty");
		const board = leaderboardDocument(
			seededLeaderboardView(),
			"Leaderboard seeded"
		);
		const boardDark = leaderboardDocument(
			seededLeaderboardView(),
			"Leaderboard seeded dark",
			"dark"
		);
		expect(habits).toContain("Example data");
		expect(habits).toContain("current days");
		expect(habits).toContain("best");
		expect(habits).toContain("Less");
		expect(habits).toContain("More");
		expect(habits).toContain("Heuristic");
		expect(habits).toContain("Monday 00:00 UTC");
		expect(habits).toContain("badge-grid");
		expect(habits).toContain(`last ${STREAK_CALENDAR_WEEKS} weeks`);
		expect(habits).not.toContain("Database migration required");
		expect(habits).toContain(">First close</a>");
		expect(habits).not.toContain("Open earning task");
		expect(habits).not.toContain("Open the task that earned this");
		expect(habits).toContain("Exercises");
		expect(habits).toContain('aria-label="App"');
		expect(habits).toContain('aria-label="Account menu"');
		expect(habits).not.toContain("Last 28 days");
		expect(habits).not.toContain("@");
		expect(empty).toContain("<b>0</b> current days");
		expect(board).toContain("ExampleYou");
		expect(board).toContain("Monday 00:00 UTC");
		expect(board).toContain("Rank 1, gold");
		expect(board).toContain("Rank 2, silver");
		expect(board).toContain("First close");
		expect(board).toContain("Clear spec");
		expect(board).toContain("One-shot");
		expect(board).toContain("Report reader");
		expect(board).toContain("Exercises");
		expect(board).toContain('aria-current="page"');
		expect(board).not.toContain("Your rank");
		expect(board).not.toContain("Your points");
		expect(board).not.toContain("Top 3");
		expect(board).not.toContain("first_close");
		expect(board).not.toContain("clear_spec");
		expect(board).not.toContain("one_shot");
		expect(board).not.toContain("Fix the flaky");
		expect(habitsDark).toContain('data-theme="dark"');
		expect(boardDark).toContain('data-theme="dark"');
		const emptyBoard = leaderboardDocument(
			emptyLeaderboardView(),
			"Leaderboard empty"
		);
		expect(emptyBoard).toContain("Nobody has opted in this week");
		expect(emptyBoard).toContain("Opt in from Settings");
		expect(emptyBoard).toContain("Join this week's board");
		const outside = leaderboardDocument(
			outsideLeaderboardView(),
			"Leaderboard outside"
		);
		expect(outside).toContain("Your rank this week");
		expect(outside).toContain("Rank 1, gold");
		const missing = leaderboardDocument(
			unavailableLeaderboardView("2026-11-13T18:00:00.000Z"),
			"Leaderboard migration"
		);
		expect(missing).toContain("Database migration required");
		expect(missing).toContain(GAMIFICATION_MIGRATE_COMMAND);
		expect(missing).toContain("Do not prisma db push");
		writeDoc("progress-habits-seeded", habits);
		writeDoc("progress-habits-seeded-dark", habitsDark);
		writeDoc("progress-habits-empty", empty);
		writeDoc("leaderboard-seeded", board);
		writeDoc("leaderboard-seeded-dark", boardDark);
		writeDoc("leaderboard-empty", emptyBoard);
		writeDoc(
			"leaderboard-empty-dark",
			leaderboardDocument(
				emptyLeaderboardView(),
				"Leaderboard empty dark",
				"dark"
			)
		);
	});

	it("screenshots habits HTML when Chrome is installed", () => {
		try {
			execFileSync("google-chrome", ["--version"], {
				stdio: "pipe",
				timeout: 3000,
			});
		} catch {
			return;
		}
		for (const name of [
			"progress-habits-seeded",
			"progress-habits-seeded-dark",
			"leaderboard-seeded",
			"leaderboard-seeded-dark",
			"leaderboard-empty",
			"leaderboard-empty-dark",
		]) {
			screenshot(name, `${ARTIFACTS}/${name}.html`);
			expect(existsSync(`${ARTIFACTS}/${name}.png`)).toBe(true);
		}
	}, 60_000);
});
