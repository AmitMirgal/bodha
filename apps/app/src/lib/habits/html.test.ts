import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	emptyHabitsView,
	seededHabitsView,
	seededLeaderboardView,
} from "./fixture";
import { habitsDocument, leaderboardDocument } from "./html";

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
				"--window-size=1280,900",
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
		expect(habits).toContain("Current streak");
		expect(habits).toContain("Heuristic");
		expect(habits).toContain("Monday 00:00 UTC");
		expect(habits).not.toContain("@");
		expect(empty).toContain("0 days");
		expect(board).toContain("ExampleYou");
		expect(board).toContain("Monday 00:00 UTC");
		expect(board).not.toContain("Fix the flaky");
		expect(habitsDark).toContain('data-theme="dark"');
		expect(boardDark).toContain('data-theme="dark"');
		writeDoc("progress-habits-seeded", habits);
		writeDoc("progress-habits-seeded-dark", habitsDark);
		writeDoc("progress-habits-empty", empty);
		writeDoc("leaderboard-seeded", board);
		writeDoc("leaderboard-seeded-dark", boardDark);
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
		]) {
			screenshot(name, `${ARTIFACTS}/${name}.html`);
			expect(existsSync(`${ARTIFACTS}/${name}.png`)).toBe(true);
		}
	}, 30_000);
});
