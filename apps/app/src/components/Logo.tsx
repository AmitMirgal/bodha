"use client";

import { Button } from "@repo/design-system/components/ui/button";
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
			<Button
				className={cn(
					"logo h-auto rounded-none px-0 hover:bg-transparent",
					className
				)}
				onClick={onClick}
				title={title}
				type="button"
				variant="ghost"
			>
				{MARK}
			</Button>
		);
	}
	return (
		<Link className={cn("logo", className)} href={href} title={title}>
			{MARK}
		</Link>
	);
}
