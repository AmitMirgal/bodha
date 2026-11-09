"use client";

import {
	Avatar,
	AvatarFallback,
} from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { signOutRequest } from "../lib/auth/sign-out";
import { runBackground } from "../lib/background";
import { emailInitials } from "../lib/user/initials";
import { NavLink } from "./NavLink";

export function UserMenu({ email }: { email: string }) {
	const router = useRouter();
	const initials = emailInitials(email);

	async function signOut() {
		await signOutRequest();
		router.push("/login");
		router.refresh();
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					aria-label={`Account menu for ${email}`}
					className="rounded-full"
					size="icon"
					type="button"
					variant="ghost"
				>
					<Avatar className="size-8">
						<AvatarFallback className="text-xs">{initials}</AvatarFallback>
					</Avatar>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-56">
				<DropdownMenuLabel className="font-normal">
					<span className="block truncate text-muted-foreground text-xs">
						Signed in
					</span>
					<span className="block truncate">{email}</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<NavLink href="/settings">Profile settings</NavLink>
				</DropdownMenuItem>
				<DropdownMenuItem
					onSelect={() => runBackground(signOut())}
					variant="destructive"
				>
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
