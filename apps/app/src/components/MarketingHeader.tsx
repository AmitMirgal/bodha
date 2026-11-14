"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@repo/design-system/components/ui/sheet";
import { Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOutRequest } from "../lib/auth/sign-out";
import { runBackground } from "../lib/background";
import { Logo } from "./Logo";

const MARKETING_LINKS = [
	{ href: "#how", label: "how it works" },
	{ href: "#rounds", label: "pick a round" },
] as const;

const SIGNED_IN_LINKS = [
	{ href: "/exercises", label: "Exercises" },
	{ href: "/progress", label: "Progress" },
	{ href: "/leaderboard", label: "Leaderboard" },
	{ href: "/settings", label: "Settings" },
] as const;

export function MarketingHeader({ email }: { email?: string | null }) {
	const router = useRouter();
	const signedIn = Boolean(email);
	const [menuOpen, setMenuOpen] = useState(false);

	async function signOut() {
		setMenuOpen(false);
		await signOutRequest();
		router.push("/");
		router.refresh();
	}

	return (
		<nav className="home-nav">
			<Logo />
			<div className="home-nav-desktop">
				{MARKETING_LINKS.map((link) => (
					<a href={link.href} key={link.href}>
						{link.label}
					</a>
				))}
				{signedIn ? (
					<>
						{SIGNED_IN_LINKS.map((link) => (
							<a href={link.href} key={link.href}>
								{link.label}
							</a>
						))}
						<button onClick={() => runBackground(signOut())} type="button">
							Sign out
						</button>
					</>
				) : (
					<a href="/login">Sign in</a>
				)}
			</div>
			<Sheet onOpenChange={setMenuOpen} open={menuOpen}>
				<SheetTrigger asChild>
					<Button
						aria-controls="marketing-mobile-nav"
						aria-expanded={menuOpen}
						aria-label={menuOpen ? "Close menu" : "Open menu"}
						className="md:hidden"
						size="icon"
						type="button"
						variant="ghost"
					>
						<Menu />
					</Button>
				</SheetTrigger>
				<SheetContent
					className="w-full max-w-xs"
					id="marketing-mobile-nav"
					side="left"
				>
					<SheetHeader>
						<SheetTitle className="p-0 font-normal">
							<SheetClose asChild>
								<Logo />
							</SheetClose>
						</SheetTitle>
						<SheetDescription className="sr-only">
							Marketing and account navigation
						</SheetDescription>
					</SheetHeader>
					<nav aria-label="Mobile" className="grid gap-2 px-4">
						{MARKETING_LINKS.map((link) => (
							<SheetClose asChild key={link.href}>
								<a
									className="min-h-11 rounded-md px-3 py-2 text-base"
									href={link.href}
								>
									{link.label}
								</a>
							</SheetClose>
						))}
						{signedIn
							? SIGNED_IN_LINKS.map((link) => (
									<SheetClose asChild key={link.href}>
										<a
											className="min-h-11 rounded-md px-3 py-2 text-base"
											href={link.href}
										>
											{link.label}
										</a>
									</SheetClose>
								))
							: null}
					</nav>
					<div className="mt-auto grid gap-2 border-t px-4 py-4">
						{signedIn ? (
							<>
								{email ? (
									<p className="truncate px-3 text-muted-foreground text-sm">
										{email}
									</p>
								) : null}
								<Button
									className="min-h-11 justify-start px-3"
									onClick={() => runBackground(signOut())}
									type="button"
									variant="ghost"
								>
									Sign out
								</Button>
							</>
						) : (
							<SheetClose asChild>
								<Button asChild className="min-h-11">
									<a href="/login">Sign in</a>
								</Button>
							</SheetClose>
						)}
					</div>
				</SheetContent>
			</Sheet>
		</nav>
	);
}
