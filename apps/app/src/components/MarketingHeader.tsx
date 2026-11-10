"use client";

import { useRouter } from "next/navigation";
import { signOutRequest } from "../lib/auth/sign-out";
import { runBackground } from "../lib/background";
import { Logo } from "./Logo";

export function MarketingHeader({ email }: { email?: string | null }) {
	const router = useRouter();
	const signedIn = Boolean(email);

	async function signOut() {
		await signOutRequest();
		router.push("/");
		router.refresh();
	}

	return (
		<nav className="home-nav">
			<Logo />
			<a href="#how">how it works</a>
			<a href="#rounds">pick a round</a>
			{signedIn ? (
				<>
					<a href="/exercises">Exercises</a>
					<a href="/progress">Progress</a>
					<button onClick={() => runBackground(signOut())} type="button">
						Sign out
					</button>
				</>
			) : (
				<a href="/login">Sign in</a>
			)}
		</nav>
	);
}
