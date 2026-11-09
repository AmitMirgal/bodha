"use client";

import Link, { useLinkStatus } from "next/link";
import { type ComponentProps, forwardRef } from "react";

export function PendingMark() {
	const { pending } = useLinkStatus();
	if (!pending) {
		return null;
	}
	return (
		<span
			aria-hidden
			className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-primary"
		/>
	);
}

export const NavLink = forwardRef<
	HTMLAnchorElement,
	ComponentProps<typeof Link>
>(function NavLink({ children, prefetch = true, ...props }, ref) {
	return (
		<Link prefetch={prefetch} ref={ref} {...props}>
			{children}
			<PendingMark />
		</Link>
	);
});
