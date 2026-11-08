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
import { type FormEvent, Suspense, useState } from "react";
import { runBackground } from "../../lib/background";
import { createBrowserSupabase } from "../../lib/supabase/client";

export default function LoginPage() {
	return (
		<Suspense fallback={<main className="p-8">Loading sign-in…</main>}>
			<LoginForm />
		</Suspense>
	);
}

function LoginForm() {
	const search = useSearchParams();
	const next = search.get("next") ?? "/";
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	async function onPassword(event: FormEvent, mode: "signin" | "signup") {
		event.preventDefault();
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const supabase = createBrowserSupabase();
			const fn =
				mode === "signin"
					? supabase.auth.signInWithPassword({ email, password })
					: supabase.auth.signUp({
							email,
							password,
							options: {
								emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
							},
						});
			const { error: authError } = await fn;
			if (authError) {
				setError(authError.message);
				return;
			}
			if (mode === "signup") {
				setMessage(
					"Check your email if confirmation is enabled, then sign in."
				);
				return;
			}
			window.location.assign(next);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Sign-in failed.");
		} finally {
			setBusy(false);
		}
	}

	async function onMagic(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError("");
		setMessage("");
		try {
			const supabase = createBrowserSupabase();
			const { error: authError } = await supabase.auth.signInWithOtp({
				email,
				options: {
					emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
				},
			});
			if (authError) {
				setError(authError.message);
				return;
			}
			setMessage("Magic link sent if that address can receive mail.");
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Could not send magic link."
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<main className="mx-auto flex min-h-[80vh] max-w-md items-center px-4">
			<Card className="w-full">
				<CardHeader>
					<CardTitle>Sign in to BODHA</CardTitle>
					<CardDescription>
						Individual learning only. Use email and password, or a magic link.
						Configure the callback URL <code>/auth/callback</code> on your
						isolated Supabase project.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						className="grid gap-4"
						onSubmit={(event) => runBackground(onPassword(event, "signin"))}
					>
						<div className="grid gap-2">
							<Label htmlFor="email">Email</Label>
							<Input
								autoComplete="email"
								id="email"
								onChange={(event) => setEmail(event.target.value)}
								required
								type="email"
								value={email}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="password">Password</Label>
							<Input
								autoComplete="current-password"
								id="password"
								onChange={(event) => setPassword(event.target.value)}
								type="password"
								value={password}
							/>
						</div>
						{error ? (
							<p className="text-destructive text-sm" role="alert">
								{error}
							</p>
						) : null}
						{message ? <output className="text-sm">{message}</output> : null}
						<div className="flex flex-wrap gap-2">
							<Button disabled={busy} type="submit">
								Sign in
							</Button>
							<Button
								disabled={busy}
								onClick={(event) => runBackground(onPassword(event, "signup"))}
								type="button"
								variant="secondary"
							>
								Create account
							</Button>
							<Button
								disabled={busy || !email}
								onClick={(event) => runBackground(onMagic(event))}
								type="button"
								variant="outline"
							>
								Send magic link
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</main>
	);
}
