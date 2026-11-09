"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { NavLink } from "./NavLink";
import { UserMenu } from "./UserMenu";

function AccountSlot({
	email,
	pending,
}: {
	email?: string | null;
	pending: boolean;
}) {
	if (pending) {
		return <Skeleton className="size-8 rounded-full" />;
	}
	if (email) {
		return <UserMenu email={email} />;
	}
	return (
		<Button asChild size="sm">
			<NavLink href="/login">Sign in</NavLink>
		</Button>
	);
}

export function AppNav({
	email,
	pending = false,
}: {
	email?: string | null;
	pending?: boolean;
}) {
	return (
		<header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
			<NavLink className="font-semibold tracking-tight" href="/">
				Mati
			</NavLink>
			<nav aria-label="Main" className="flex flex-wrap items-center gap-2">
				<Button asChild size="sm" variant="ghost">
					<NavLink href="/">Exercises</NavLink>
				</Button>
				<Button asChild size="sm" variant="ghost">
					<NavLink href="/progress">Progress</NavLink>
				</Button>
				<AccountSlot email={email} pending={pending} />
			</nav>
		</header>
	);
}
