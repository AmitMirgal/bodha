"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
	type AuthIntent,
	loginStatusCopy,
	submitLoginForm,
} from "../lib/auth/login-form";
import { runBackground } from "../lib/background";
import { safeNextPath } from "../lib/http/safe-next";
import { createBrowserSupabase } from "../lib/supabase/client";

const CALLBACK_ERROR: Record<string, string> = {
	link: "That email link is invalid or expired. Create an account or sign in again.",
	missing_code: "That email link was incomplete. Request a new one.",
};

function submitterIntent(event: FormEvent<HTMLFormElement>): string | null {
	const native = event.nativeEvent;
	if ("submitter" in native && native.submitter instanceof HTMLButtonElement) {
		return native.submitter.value;
	}
	return null;
}

function heading(mode: AuthIntent): string {
	switch (mode) {
		case "signup":
			return "Create your account";
		case "signin":
			return "Sign in to Mati";
		case "magic":
			return "Email me a sign-in link";
		default: {
			const exhaustive: never = mode;
			return String(exhaustive);
		}
	}
}

function actionLabel(mode: AuthIntent, busy: boolean): string {
	if (busy) {
		switch (mode) {
			case "signup":
				return "Creating account…";
			case "signin":
				return "Signing in…";
			case "magic":
				return "Sending link…";
			default: {
				const exhaustive: never = mode;
				return String(exhaustive);
			}
		}
	}
	switch (mode) {
		case "signup":
			return "Create account";
		case "signin":
			return "Sign in";
		case "magic":
			return "Send email link";
		default: {
			const exhaustive: never = mode;
			return String(exhaustive);
		}
	}
}

export function LoginForm() {
	const search = useSearchParams();
	const next = safeNextPath(search.get("next"));
	const callbackError = search.get("error");
	const [mode, setMode] = useState<AuthIntent>("signup");
	const [status, setStatus] = useState(() =>
		callbackError && callbackError in CALLBACK_ERROR
			? CALLBACK_ERROR[callbackError]
			: ""
	);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const intent = submitterIntent(event) ?? mode;
		setBusy(true);
		setError("");
		setStatus("");
		try {
			const result = await submitLoginForm(
				createBrowserSupabase(),
				new FormData(event.currentTarget),
				{
					emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
					submitterIntent: intent,
				}
			);
			if (result.kind === "error") {
				setError(result.message);
				return;
			}
			if (result.kind === "signed_in") {
				window.location.assign(next);
				return;
			}
			setStatus(loginStatusCopy(result));
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Something went wrong."
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<main className="mx-auto flex min-h-[100dvh] w-full max-w-md items-center px-4 py-8">
			<Card className="w-full border-border shadow-lg">
				<CardHeader className="gap-3">
					<p className="font-mono text-muted-foreground text-xs tracking-wide">
						mati
					</p>
					<CardTitle className="text-2xl tracking-tight">
						{heading(mode)}
					</CardTitle>
					<CardDescription>
						Individual learning with your email. No shared classrooms.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						className="grid gap-4"
						onSubmit={(event) => runBackground(onSubmit(event))}
					>
						<div aria-label="Account action" className="seg" role="tablist">
							<button
								aria-selected={mode === "signin"}
								className={mode === "signin" ? "on" : undefined}
								onClick={() => setMode("signin")}
								role="tab"
								type="button"
							>
								Sign in
							</button>
							<button
								aria-selected={mode === "signup"}
								className={mode === "signup" ? "on" : undefined}
								onClick={() => setMode("signup")}
								role="tab"
								type="button"
							>
								Create account
							</button>
							<button
								aria-selected={mode === "magic"}
								className={mode === "magic" ? "on" : undefined}
								onClick={() => setMode("magic")}
								role="tab"
								type="button"
							>
								Email link
							</button>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="email">Email</Label>
							<Input
								autoCapitalize="none"
								autoComplete="email"
								id="email"
								name="email"
								required
								spellCheck={false}
								type="email"
							/>
						</div>
						<div className={mode === "magic" ? "hidden" : "grid gap-2"}>
							<Label htmlFor="password">Password</Label>
							<Input
								autoComplete={
									mode === "signup" ? "new-password" : "current-password"
								}
								id="password"
								minLength={6}
								name="password"
								required={mode !== "magic"}
								type="password"
							/>
						</div>
						{error ? (
							<p className="text-destructive text-sm" role="alert">
								{error}
							</p>
						) : null}
						{status ? (
							<output className="text-muted-foreground text-sm">
								{status}
							</output>
						) : null}
						<div className="grid gap-2">
							<Button
								aria-busy={busy}
								className="w-full"
								disabled={busy}
								name="intent"
								type="submit"
								value={mode}
							>
								{actionLabel(mode, busy)}
							</Button>
							{mode === "signup" ? (
								<Button
									className="w-full"
									disabled={busy}
									name="intent"
									type="submit"
									value="signin"
									variant="secondary"
								>
									Sign in
								</Button>
							) : (
								<Button
									className="w-full"
									disabled={busy}
									name="intent"
									type="submit"
									value="signup"
									variant="secondary"
								>
									Create account
								</Button>
							)}
							{mode === "magic" ? null : (
								<Button
									className="w-full"
									disabled={busy}
									name="intent"
									type="submit"
									value="magic"
									variant="outline"
								>
									Send email link
								</Button>
							)}
						</div>
						<p className="text-muted-foreground text-xs">
							After you create an account we may ask you to confirm that email
							before you can sign in.
						</p>
					</form>
				</CardContent>
			</Card>
		</main>
	);
}
