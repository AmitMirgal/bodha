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
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import {
	type AuthIntent,
	loginStatusCopy,
	submitLoginForm,
} from "../lib/auth/login-form";
import { runBackground } from "../lib/background";
import { safeNextPath } from "../lib/http/safe-next";
import { createBrowserSupabase } from "../lib/supabase/client";
import { Logo } from "./Logo";

const CALLBACK_ERROR: Record<string, string> = {
	link: "That email link is invalid or expired. Create an account or sign in again.",
	missing_code: "That email link was incomplete. Request a new one.",
};

function parseAuthIntent(value: string): AuthIntent {
	switch (value) {
		case "signin":
		case "signup":
		case "magic":
			return value;
		default:
			return "signin";
	}
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
	const errorId = useId();
	const statusId = useId();
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
		setBusy(true);
		setError("");
		setStatus("");
		try {
			const result = await submitLoginForm(
				createBrowserSupabase(),
				new FormData(event.currentTarget),
				{
					emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
					submitterIntent: mode,
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

	const describedBy =
		[error ? errorId : null, status ? statusId : null]
			.filter(Boolean)
			.join(" ") || undefined;

	return (
		<main className="mx-auto flex min-h-[100dvh] w-full min-w-0 max-w-md items-center px-4 py-10">
			<Card className="w-full border-border shadow-lg">
				<CardHeader className="gap-3">
					<Logo />
					<CardTitle className="text-2xl tracking-tight">
						{heading(mode)}
					</CardTitle>
					<CardDescription>
						Individual learning with your email. No shared classrooms.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Tabs
						className="gap-6"
						onValueChange={(value) => {
							setMode(parseAuthIntent(value));
							setError("");
						}}
						value={mode}
					>
						<TabsList
							aria-label="Sign-in method"
							className="grid h-auto w-full grid-cols-3"
						>
							<TabsTrigger
								className="min-h-11 px-1 text-xs sm:px-2 sm:text-sm"
								value="signin"
							>
								Sign in
							</TabsTrigger>
							<TabsTrigger
								className="min-h-11 px-1 text-xs sm:px-2 sm:text-sm"
								value="signup"
							>
								Create account
							</TabsTrigger>
							<TabsTrigger
								className="min-h-11 px-1 text-xs sm:px-2 sm:text-sm"
								value="magic"
							>
								Email link
							</TabsTrigger>
						</TabsList>
						{error ? (
							<p className="text-destructive text-sm" id={errorId} role="alert">
								{error}
							</p>
						) : null}
						{status ? (
							<output className="text-muted-foreground text-sm" id={statusId}>
								{status}
							</output>
						) : null}
						<TabsContent className="mt-0" value="signin">
							<form
								aria-describedby={describedBy}
								className="grid gap-6"
								onSubmit={(event) => runBackground(onSubmit(event))}
							>
								<input name="intent" type="hidden" value="signin" />
								<div className="grid gap-2">
									<Label htmlFor="email-signin">Email</Label>
									<Input
										aria-invalid={Boolean(error)}
										autoCapitalize="none"
										autoComplete="email"
										id="email-signin"
										name="email"
										required
										spellCheck={false}
										type="email"
									/>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="password-signin">Password</Label>
									<Input
										aria-invalid={Boolean(error)}
										autoComplete="current-password"
										id="password-signin"
										minLength={6}
										name="password"
										required
										type="password"
									/>
								</div>
								<Button
									aria-busy={busy}
									className="w-full"
									disabled={busy}
									type="submit"
								>
									{actionLabel("signin", busy)}
								</Button>
							</form>
						</TabsContent>
						<TabsContent className="mt-0" value="signup">
							<form
								aria-describedby={describedBy}
								className="grid gap-6"
								onSubmit={(event) => runBackground(onSubmit(event))}
							>
								<input name="intent" type="hidden" value="signup" />
								<div className="grid gap-2">
									<Label htmlFor="email-signup">Email</Label>
									<Input
										aria-invalid={Boolean(error)}
										autoCapitalize="none"
										autoComplete="email"
										id="email-signup"
										name="email"
										required
										spellCheck={false}
										type="email"
									/>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="password-signup">Password</Label>
									<Input
										aria-invalid={Boolean(error)}
										autoComplete="new-password"
										id="password-signup"
										minLength={6}
										name="password"
										required
										type="password"
									/>
								</div>
								<Button
									aria-busy={busy}
									className="w-full"
									disabled={busy}
									type="submit"
								>
									{actionLabel("signup", busy)}
								</Button>
								<p className="text-muted-foreground text-sm">
									After you create an account we may ask you to confirm that
									email before you can sign in.
								</p>
							</form>
						</TabsContent>
						<TabsContent className="mt-0" value="magic">
							<form
								aria-describedby={describedBy}
								className="grid gap-6"
								onSubmit={(event) => runBackground(onSubmit(event))}
							>
								<input name="intent" type="hidden" value="magic" />
								<div className="grid gap-2">
									<Label htmlFor="email-magic">Email</Label>
									<Input
										aria-invalid={Boolean(error)}
										autoCapitalize="none"
										autoComplete="email"
										id="email-magic"
										name="email"
										required
										spellCheck={false}
										type="email"
									/>
								</div>
								<Button
									aria-busy={busy}
									className="w-full"
									disabled={busy}
									type="submit"
								>
									{actionLabel("magic", busy)}
								</Button>
							</form>
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>
		</main>
	);
}
