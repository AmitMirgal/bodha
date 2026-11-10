import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
	new URL("./LoginForm.tsx", import.meta.url),
	"utf8"
);

describe("login tabs show one action each", () => {
	it("uses shadcn Tabs with a single submit control bound to the active tab", () => {
		expect(source).toMatch(/TabsTrigger/);
		expect(source).toMatch(/value="signin"/);
		expect(source).toMatch(/value="signup"/);
		expect(source).toMatch(/value="magic"/);
		expect(source.match(/type="submit"/g)?.length).toBe(3);
		expect(source).toMatch(/TabsContent/);
		expect(source).not.toMatch(/variant="secondary"/);
	});

	it("hides the password field on the email-link tab", () => {
		expect(source).toMatch(/value="magic"/);
		expect(source).not.toMatch(/id="password-magic"/);
	});

	it("keeps the confirm-email note on Create account only", () => {
		expect(source).toMatch(/confirm that\s+email before you can sign in/s);
		const signupPanel = source.indexOf(
			'<TabsContent className="mt-0" value="signup">'
		);
		const magicPanel = source.indexOf(
			'<TabsContent className="mt-0" value="magic">'
		);
		const note = source.indexOf("confirm that");
		expect(note).toBeGreaterThan(signupPanel);
		expect(note).toBeLessThan(magicPanel);
	});

	it("sends signed-in users to next or /exercises", () => {
		expect(source).toMatch(/safeNextPath\(search\.get\("next"\)\)/);
		expect(source).toMatch(/window\.location\.assign\(next\)/);
	});
});
