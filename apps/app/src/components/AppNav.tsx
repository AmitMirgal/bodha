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
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@repo/design-system/components/ui/sheet";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { NavLink } from "./NavLink";
import { UserMenu } from "./UserMenu";

export const APP_NAV_LINKS = [
	{ href: "/exercises", label: "Exercises" },
	{ href: "/progress", label: "Progress" },
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
		return <Skeleton className="size-9 rounded-full" />;
	}
	if (email) {
		return <UserMenu email={email} />;
	}
	return (
		<Button asChild>
			<NavLink href="/login">Sign in</NavLink>
		</Button>
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

	return (
		<header className="sticky top-0 z-40 border-b bg-background/95 px-4 py-3 backdrop-blur-sm">
			<div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
				<Logo />
				<NavigationMenu className="hidden md:flex" viewport={false}>
					<NavigationMenuList>
						<NavItems pathname={pathname} />
					</NavigationMenuList>
				</NavigationMenu>
				<div className="flex items-center gap-2">
					<Sheet>
						<SheetTrigger asChild>
							<Button
								aria-label="Open menu"
								className="md:hidden"
								size="icon"
								type="button"
								variant="ghost"
							>
								<Menu />
							</Button>
						</SheetTrigger>
						<SheetContent side="left">
							<SheetHeader>
								<SheetTitle className="p-0 font-normal">
									<Logo />
								</SheetTitle>
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
						</SheetContent>
					</Sheet>
					<AccountSlot email={email} pending={pending} />
				</div>
			</div>
		</header>
	);
}
