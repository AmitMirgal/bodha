"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	navigationMenuTriggerStyle,
} from "@repo/design-system/components/ui/navigation-menu";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@repo/design-system/components/ui/sheet";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { signOutRequest } from "../lib/auth/sign-out";
import { runBackground } from "../lib/background";
import { Logo } from "./Logo";
import { NavLink } from "./NavLink";
import { UserMenu } from "./UserMenu";

export const APP_NAV_LINKS = [
	{ href: "/exercises", label: "Exercises" },
	{ href: "/progress", label: "Progress" },
	{ href: "/leaderboard", label: "Leaderboard" },
] as const;

function pathActive(pathname: string, href: string): boolean {
	if (href === "/exercises") {
		return pathname === "/exercises" || pathname.startsWith("/session/");
	}
	if (href === "/progress") {
		return (
			pathname === "/progress" ||
			pathname.startsWith("/progress/") ||
			pathname.startsWith("/capture/tasks/")
		);
	}
	if (href === "/leaderboard") {
		return pathname === "/leaderboard" || pathname.startsWith("/leaderboard/");
	}
	return pathname === href;
}

function AccountSlot({
	email,
	pending,
}: {
	email?: string | null;
	pending: boolean;
}) {
	if (pending) {
		return <Skeleton className="hidden size-9 rounded-full md:block" />;
	}
	if (email) {
		return (
			<div className="hidden md:block">
				<UserMenu email={email} />
			</div>
		);
	}
	return (
		<Button asChild className="hidden md:inline-flex">
			<NavLink href="/login">Sign in</NavLink>
		</Button>
	);
}

function MobileAccount({
	email,
	onSignOut,
	pathname,
	pending,
}: {
	email?: string | null;
	onSignOut: () => void;
	pathname: string;
	pending: boolean;
}) {
	if (pending) {
		return <Skeleton className="h-11 w-full rounded-md" />;
	}
	if (email) {
		const settingsActive = pathname === "/settings";
		return (
			<>
				<p className="truncate px-3 text-muted-foreground text-sm">{email}</p>
				<SheetClose asChild>
					<NavLink
						aria-current={settingsActive ? "page" : undefined}
						className={`min-h-11 rounded-md px-3 py-2 text-base ${
							settingsActive
								? "bg-accent font-medium text-accent-foreground"
								: "text-foreground"
						}`}
						href="/settings"
					>
						Settings
					</NavLink>
				</SheetClose>
				<Button
					className="min-h-11 justify-start px-3"
					onClick={onSignOut}
					type="button"
					variant="ghost"
				>
					Sign out
				</Button>
			</>
		);
	}
	return (
		<SheetClose asChild>
			<Button asChild className="min-h-11">
				<NavLink href="/login">Sign in</NavLink>
			</Button>
		</SheetClose>
	);
}

function NavItems({
	onNavigate,
	pathname,
}: {
	onNavigate?: () => void;
	pathname: string;
}) {
	return (
		<>
			{APP_NAV_LINKS.map((link) => {
				const active = pathActive(pathname, link.href);
				return (
					<NavigationMenuItem key={link.href}>
						<NavigationMenuLink active={active} asChild>
							<NavLink
								aria-current={active ? "page" : undefined}
								className={navigationMenuTriggerStyle()}
								href={link.href}
								onClick={onNavigate}
							>
								{link.label}
							</NavLink>
						</NavigationMenuLink>
					</NavigationMenuItem>
				);
			})}
		</>
	);
}

export function AppNav({
	email,
	pending = false,
}: {
	email?: string | null;
	pending?: boolean;
}) {
	const pathname = usePathname();
	const router = useRouter();
	const [menuOpen, setMenuOpen] = useState(false);

	async function signOut() {
		setMenuOpen(false);
		await signOutRequest();
		router.push("/login");
		router.refresh();
	}

	return (
		<header className="sticky top-0 z-40 border-b bg-background/95 px-4 py-3 backdrop-blur-sm">
			<div className="mx-auto flex min-w-0 max-w-6xl items-center justify-between gap-3">
				<Logo />
				<NavigationMenu className="hidden md:flex" viewport={false}>
					<NavigationMenuList>
						<NavItems pathname={pathname} />
					</NavigationMenuList>
				</NavigationMenu>
				<div className="flex min-w-0 items-center gap-2">
					<Sheet onOpenChange={setMenuOpen} open={menuOpen}>
						<SheetTrigger asChild>
							<Button
								aria-controls="app-mobile-nav"
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
							id="app-mobile-nav"
							side="left"
						>
							<SheetHeader>
								<SheetTitle className="p-0 font-normal">
									<SheetClose asChild>
										<Logo />
									</SheetClose>
								</SheetTitle>
								<SheetDescription className="sr-only">
									Exercises, Progress, Leaderboard, and account
								</SheetDescription>
							</SheetHeader>
							<nav aria-label="Mobile" className="grid gap-2 px-4">
								{APP_NAV_LINKS.map((link) => {
									const active = pathActive(pathname, link.href);
									return (
										<SheetClose asChild key={link.href}>
											<NavLink
												aria-current={active ? "page" : undefined}
												className={`min-h-11 rounded-md px-3 py-2 text-base ${
													active
														? "bg-accent font-medium text-accent-foreground"
														: "text-foreground"
												}`}
												href={link.href}
											>
												{link.label}
											</NavLink>
										</SheetClose>
									);
								})}
							</nav>
							<div className="mt-auto grid gap-2 border-t px-4 py-4">
								<MobileAccount
									email={email}
									onSignOut={() => runBackground(signOut())}
									pathname={pathname}
									pending={pending}
								/>
							</div>
						</SheetContent>
					</Sheet>
					<AccountSlot email={email} pending={pending} />
				</div>
			</div>
		</header>
	);
}
