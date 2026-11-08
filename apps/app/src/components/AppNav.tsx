"use client";

import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { runBackground } from "../lib/background";

export function AppNav({ email }: { email?: string | null }) {
	const router = useRouter();

	async function signOut() {
		await fetch("/api/auth/sign-out", { method: "POST" });
		router.push("/login");
		router.refresh();
	}

	return (
		<header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
			<Link className="font-semibold tracking-tight" href="/">
				BODHA
			</Link>
			<nav aria-label="Main" className="flex flex-wrap items-center gap-2">
				<Button asChild size="sm" variant="ghost">
					<Link href="/">Exercises</Link>
				</Button>
				<Button asChild size="sm" variant="ghost">
					<Link href="/progress">Daily progress</Link>
				</Button>
				<Button asChild size="sm" variant="ghost">
					<Link href="/settings">LLM settings</Link>
				</Button>
				{email ? (
					<span className="text-muted-foreground text-sm">{email}</span>
				) : null}
				{email ? (
					<Button
						onClick={() => runBackground(signOut())}
						size="sm"
						type="button"
						variant="outline"
					>
						Sign out
					</Button>
				) : (
					<Button asChild size="sm">
						<Link href="/login">Sign in</Link>
					</Button>
				)}
			</nav>
		</header>
	);
}
