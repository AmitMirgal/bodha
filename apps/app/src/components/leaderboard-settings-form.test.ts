import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const form = readFileSync(
	new URL("./LeaderboardSettingsForm.tsx", import.meta.url),
	"utf8"
);
const route = readFileSync(
	new URL("../app/api/habits/leaderboard-settings/route.ts", import.meta.url),
	"utf8"
);

describe("leaderboard settings opt-in", () => {
	it("saves display name and opt-in together instead of toggling a silent PUT", () => {
		expect(form).toMatch(/type="submit"/);
		expect(form).toMatch(/Save leaderboard settings/);
		expect(form).toMatch(/onCheckedChange=\{setOptedIn\}/);
		expect(form).not.toMatch(/onCheckedChange=\{\(checked\) =>/);
		expect(form).toMatch(/role="alert"/);
		expect(form).toMatch(/parseDisplayName/);
	});

	it("uses a shadcn Select for the Settings provider field", () => {
		const llm = readFileSync(
			new URL("./LlmSettingsForm.tsx", import.meta.url),
			"utf8"
		);
		expect(llm).toMatch(/SelectTrigger className="w-full"/);
		expect(llm).not.toMatch(/<select/);
	});

	it("maps CHECK and RLS failures to JSON instead of an uncaught 500", () => {
		expect(route).toMatch(/parseLeaderboardSettingsBody/);
		expect(route).toMatch(/leaderboardSettingsWriteError/);
		expect(route).toMatch(/status: mapped.status/);
	});
});
