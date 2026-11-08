import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
	loginStatusCopy,
	mapAuthError,
	readLoginIntent,
	submitLoginForm,
} from "./login-form";

const EMAIL = "learner@example.test";
const PASSWORD = "synthetic-passphrase";

function requestUrl(input: RequestInfo | URL): string {
	if (typeof input === "string") {
		return input;
	}
	if (input instanceof URL) {
		return input.href;
	}
	return input.url;
}

function isSignup(url: string): boolean {
	return /\/signup(?:\?|$)/.test(url);
}

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [name, value] of Object.entries(fields)) {
		data.set(name, value);
	}
	return data;
}

describe("login form credentials", () => {
	it("does not invoke auth when signup email or password is missing", async () => {
		const signUp = vi.fn();
		const client = {
			auth: {
				signUp,
				signInWithPassword: vi.fn(),
				signInWithOtp: vi.fn(),
			},
		};
		const empty = await submitLoginForm(
			client,
			form({ intent: "signup", email: "", password: "" }),
			{ emailRedirectTo: "http://127.0.0.1/auth/callback" }
		);
		expect(empty).toEqual({
			kind: "error",
			message: "Enter a valid email address to create an account.",
		});
		const noPassword = await submitLoginForm(
			client,
			form({ intent: "signup", email: EMAIL, password: "" }),
			{ emailRedirectTo: "http://127.0.0.1/auth/callback" }
		);
		expect(noPassword.kind).toBe("error");
		const misnamed = await submitLoginForm(
			client,
			form({
				intent: "signup",
				user: EMAIL,
				pass: PASSWORD,
			}),
			{ emailRedirectTo: "http://127.0.0.1/auth/callback" }
		);
		expect(misnamed.kind).toBe("error");
		expect(signUp).not.toHaveBeenCalled();
	});

	it("sends named email and password to signUp, never signInAnonymously", async () => {
		const signUp = vi.fn(async (args: { email: string; password: string }) => {
			expect(args.email).toBe(EMAIL);
			expect(args.password).toBe(PASSWORD);
			await Promise.resolve();
			return {
				data: { user: { id: "user-synthetic" }, session: null },
				error: null,
			};
		});
		const client = {
			auth: {
				signUp,
				signInWithPassword: vi.fn(),
				signInWithOtp: vi.fn(),
				signInAnonymously: vi.fn(),
			},
		};
		const result = await submitLoginForm(
			client,
			form({ intent: "signup", email: EMAIL, password: PASSWORD }),
			{
				emailRedirectTo: "http://127.0.0.1/auth/callback?next=%2F",
				submitterIntent: "signup",
			}
		);
		expect(result).toEqual({ kind: "confirm_email" });
		expect(loginStatusCopy(result)).toMatch(/confirm your account/);
		expect(signUp).toHaveBeenCalledTimes(1);
		expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
		expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
	});

	it("treats a signup session as signed in", async () => {
		const result = await submitLoginForm(
			{
				auth: {
					signUp: async () => ({
						data: {
							user: { id: "user-synthetic" },
							session: { access_token: "synthetic" },
						},
						error: null,
					}),
					signInWithPassword: vi.fn(),
					signInWithOtp: vi.fn(),
				},
			},
			form({ intent: "signup", email: EMAIL, password: PASSWORD }),
			{ emailRedirectTo: "http://127.0.0.1/auth/callback" }
		);
		expect(result).toEqual({ kind: "signed_in" });
	});

	it("surfaces provider errors without enabling anonymous auth", async () => {
		const result = await submitLoginForm(
			{
				auth: {
					signUp: async () => ({
						data: { user: null, session: null },
						error: { message: "User already registered" },
					}),
					signInWithPassword: vi.fn(),
					signInWithOtp: vi.fn(),
				},
			},
			form({ intent: "signup", email: EMAIL, password: PASSWORD }),
			{ emailRedirectTo: "http://127.0.0.1/auth/callback" }
		);
		expect(result).toEqual({
			kind: "error",
			message: "An account with that email already exists. Sign in instead.",
		});
	});

	it("selects signup from the submitter even if intent is missing", () => {
		expect(readLoginIntent(form({}), "signup")).toBe("signup");
	});
});

describe("empty signUp payload against GoTrue /signup", () => {
	it("posts email-less signup and gets Anonymous sign-ins are disabled", async () => {
		const requests: { body: unknown; url: string }[] = [];
		const fetchMock: typeof fetch = async (input, init) => {
			const url = requestUrl(input);
			const raw = typeof init?.body === "string" ? init.body : "{}";
			requests.push({ url, body: JSON.parse(raw) });
			return await Promise.resolve(
				new Response(
					JSON.stringify({
						error: "invalid_request",
						msg: "Anonymous sign-ins are disabled",
					}),
					{ headers: { "content-type": "application/json" }, status: 422 }
				)
			);
		};
		const client = createClient(
			"http://127.0.0.1:54321",
			"synthetic-anon-key",
			{
				auth: { autoRefreshToken: false, persistSession: false },
				global: { fetch: fetchMock },
			}
		);
		const { error } = await client.auth.signUp({ email: "", password: "" });
		expect(error?.message).toMatch(/Anonymous sign-ins are disabled/i);
		expect(requests).toHaveLength(1);
		expect(isSignup(requests[0]?.url ?? "")).toBe(true);
		const body = requests[0]?.body as { email?: string; password?: string };
		expect(body.email).toBe("");
		expect(body.password).toBe("");
	});

	it("validated form submission posts email and password on /signup", async () => {
		const requests: { body: unknown; url: string }[] = [];
		const fetchMock: typeof fetch = async (input, init) => {
			const url = requestUrl(input);
			const raw = typeof init?.body === "string" ? init.body : "{}";
			requests.push({ url, body: JSON.parse(raw) });
			return await Promise.resolve(
				new Response(
					JSON.stringify({
						user: {
							id: "11111111-1111-4111-8111-111111111111",
							email: EMAIL,
						},
						session: null,
					}),
					{ headers: { "content-type": "application/json" }, status: 200 }
				)
			);
		};
		const client = createClient(
			"http://127.0.0.1:54321",
			"synthetic-anon-key",
			{
				auth: { autoRefreshToken: false, persistSession: false },
				global: { fetch: fetchMock },
			}
		);
		const result = await submitLoginForm(
			client,
			form({ intent: "signup", email: EMAIL, password: PASSWORD }),
			{ emailRedirectTo: "http://127.0.0.1/auth/callback?next=%2F" }
		);
		expect(result.kind).toBe("confirm_email");
		expect(requests.some((row) => isSignup(row.url))).toBe(true);
		const signup = requests.find((row) => isSignup(row.url));
		const body = signup?.body as { email?: string; password?: string };
		expect(body.email).toBe(EMAIL);
		expect(body.password).toBe(PASSWORD);
	});
});

describe("mapAuthError", () => {
	it("does not tell the learner to enable anonymous sign-ins", () => {
		expect(mapAuthError("Anonymous sign-ins are disabled", "signup")).toBe(
			"Enter your email and a password to create an account."
		);
	});
});
