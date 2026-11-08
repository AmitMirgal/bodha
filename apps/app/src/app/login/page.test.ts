import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const form = readFileSync(
	new URL("../../components/LoginForm.tsx", import.meta.url),
	"utf8"
);

describe("login page contracts", () => {
	it("keeps learner copy free of operator setup instructions", () => {
		expect(form).not.toMatch(/isolated Supabase/i);
		expect(form).not.toMatch(/callback URL/i);
		expect(form).not.toMatch(/NEXT_PUBLIC_/);
		expect(page).not.toMatch(/isolated Supabase/i);
	});

	it("posts named email and password through a signup submitter", () => {
		expect(form).toMatch(/name="email"/);
		expect(form).toMatch(/name="password"/);
		expect(form).toMatch(/value="signup"/);
		expect(form).toMatch(/type="submit"/);
		expect(form).not.toMatch(/signInAnonymously/);
		expect(form).toMatch(/new FormData\(event\.currentTarget\)/);
	});
});
