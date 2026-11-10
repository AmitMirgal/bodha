"use client";

import { cn } from "@repo/design-system/lib/utils";
import Link from "next/link";

const MARK = (
	<>
		<span>{"//"}</span> Mati
	</>
);

export function Logo({
	className,
	href = "/",
	onClick,
	title,
}: {
	className?: string;
	href?: string;
	onClick?: () => void;
	title?: string;
}) {
	if (onClick) {
		return (
			<button
				className={cn("logo", className)}
				onClick={onClick}
				title={title}
				type="button"
			>
				{MARK}
			</button>
		);
	}
	return (
		<Link className={cn("logo", className)} href={href} title={title}>
			{MARK}
		</Link>
	);
}
