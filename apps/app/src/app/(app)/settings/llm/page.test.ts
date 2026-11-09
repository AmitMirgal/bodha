import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const redirectPage = readFileSync(
	new URL("./page.tsx", import.meta.url),
	"utf8"
);
const settingsPage = readFileSync(
	new URL("../page.tsx", import.meta.url),
	"utf8"
);
const settingsScreen = readFileSync(
	new URL("../../../../components/SettingsScreen.tsx", import.meta.url),
	"utf8"
);

describe("settings routes", () => {
	it("redirects the old LLM settings URL to /settings", () => {
		expect(redirectPage).toMatch(/redirect\("\/settings"\)/);
	});

	it("shows a Settings heading, not Profile settings", () => {
		expect(settingsScreen).toMatch(/>Settings</);
		expect(settingsScreen).not.toMatch(/Profile settings/);
	});

	it("shows read-only profile email and the LLM form on /settings", () => {
		expect(settingsPage).toMatch(/SettingsScreen/);
		expect(settingsPage).not.toMatch(/AppNav/);
		expect(settingsScreen).toMatch(/readOnly/);
		expect(settingsScreen).toMatch(/profile-email/);
		expect(settingsScreen).toMatch(/LlmSettingsForm/);
		expect(settingsScreen).toMatch(/ThemeSwitcher/);
	});
});
