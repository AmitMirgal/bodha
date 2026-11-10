"use client";

import { useRouter } from "next/navigation";
import { signOutRequest } from "../lib/auth/sign-out";
import { runBackground } from "../lib/background";

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
			<div className="logo static">
				<span>{"//"}</span> Mati
			</div>
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
